use super::SearchResult;
use crate::error::AppResult;

#[derive(Debug, Default)]
pub(crate) struct SearchFilter {
    pub(crate) file_name: Option<String>,
    pub(crate) directory_name: Option<String>,
    pub(crate) regex_pattern: Option<regex::Regex>,
    pub(crate) plain_text: Option<String>,
}

impl SearchFilter {
    fn is_empty(&self) -> bool {
        self.file_name.is_none()
            && self.directory_name.is_none()
            && self.regex_pattern.is_none()
            && self.plain_text.is_none()
    }

    fn score_query(&self) -> String {
        if let Some(file_name) = &self.file_name {
            file_name.clone()
        } else if let Some(directory_name) = &self.directory_name {
            directory_name.clone()
        } else if let Some(plain_text) = &self.plain_text {
            plain_text.clone()
        } else {
            String::new()
        }
    }
}

/// Parse a search query into structured filters.
/// Supports: file:<name>, dir:<name>, regex (auto-detected), plain text.
pub(crate) fn parse_search_query(query: &str) -> SearchFilter {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return SearchFilter::default();
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    let mut file_name = None;
    let mut directory_name = None;
    let mut remaining_parts = Vec::new();

    for part in &parts {
        let lower = part.to_lowercase();
        if lower.starts_with("file:") && part.len() > 5 {
            file_name = Some(part[5..].to_string());
        } else if lower.starts_with("dir:") && part.len() > 4 {
            directory_name = Some(part[4..].to_string());
        } else {
            remaining_parts.push(*part);
        }
    }

    let remaining = remaining_parts.join(" ");
    let regex_special = regex::Regex::new(r"[.*?\[\]()|^${}+\\]")
        .expect("search regex special chars pattern must be valid");

    let (regex_pattern, plain_text) = if !remaining.is_empty() {
        if regex_special.is_match(&remaining) {
            match regex::Regex::new(&format!("(?i){}", remaining)) {
                Ok(re) => (Some(re), None),
                Err(_) => (None, Some(remaining)),
            }
        } else {
            (None, Some(remaining))
        }
    } else {
        (None, None)
    };

    SearchFilter {
        file_name,
        directory_name,
        regex_pattern,
        plain_text,
    }
}

/// Compute relevance score for a search result.
/// Higher score = better match.
pub(crate) fn compute_score(name: &str, path: &str, query: &str, is_dir: bool) -> i32 {
    if query.is_empty() {
        return 0;
    }

    let name_lower = name.to_lowercase();
    let path_lower = path.to_lowercase();
    let query_lower = query.to_lowercase();
    let mut score = 0i32;

    if name_lower == query_lower {
        score += 100;
    } else if name_lower.starts_with(&query_lower) {
        score += 50;
    } else if name_lower.contains(&query_lower) {
        score += 30;
    } else if path_lower.contains(&query_lower) {
        score += 10;
    }

    if name_lower.contains(&query_lower) && name.len() < 20 {
        score += 5;
    }

    if !is_dir && score > 0 {
        score += 1;
    }

    score
}

pub(crate) fn search_db(
    conn: &rusqlite::Connection,
    pattern: &str,
) -> AppResult<Vec<SearchResult>> {
    let filters = parse_search_query(pattern);
    if filters.is_empty() {
        return Ok(Vec::new());
    }

    let (where_clause, param_values) = build_where_clause(&filters);
    let query = format!(
        "SELECT path, parent_path, name, size, mtime, is_dir, token_count, fingerprint,
         (SELECT COUNT(*) FROM files f2 WHERE f2.parent_path = files.path) as child_count
         FROM files
         WHERE {}
         LIMIT 500",
        where_clause
    );

    let mut stmt = conn.prepare(&query)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = param_values
        .iter()
        .map(|value| value as &dyn rusqlite::types::ToSql)
        .collect();

    let entries: Vec<SearchRow> = stmt
        .query_map(rusqlite::params_from_iter(param_refs), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, i32>(5)? != 0,
                row.get::<_, Option<i64>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<i64>>(8)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let score_query = filters.score_query();
    let mut results: Vec<SearchResult> = entries
        .into_iter()
        .map(
            |(path, parent_path, name, size, mtime, is_dir, token_count, fingerprint, child_count)| {
                let score = compute_score(&name, &path, &score_query, is_dir);
                SearchResult {
                    path,
                    parent_path,
                    name,
                    size,
                    mtime,
                    is_dir,
                    token_count,
                    fingerprint,
                    child_count,
                    score,
                }
            },
        )
        .collect();

    if let Some(regex) = &filters.regex_pattern {
        results.retain(|result| regex.is_match(&result.name) || regex.is_match(&result.path));
        for result in &mut results {
            result.score = if regex.is_match(&result.name) { 50 } else { 10 };
        }
    }

    results.retain(|result| result.score > 0);
    results.sort_by(|a, b| b.score.cmp(&a.score).then_with(|| a.name.cmp(&b.name)));

    Ok(results)
}

type SearchRow = (
    String,
    Option<String>,
    String,
    Option<i64>,
    Option<i64>,
    bool,
    Option<i64>,
    Option<String>,
    Option<i64>,
);

fn build_where_clause(filters: &SearchFilter) -> (String, Vec<String>) {
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<String> = Vec::new();

    if let Some(file_name) = &filters.file_name {
        conditions.push("(is_dir = 0 AND LOWER(name) LIKE ?)".to_string());
        param_values.push(format!("%{}%", file_name.to_lowercase()));
    }

    if let Some(dir_name) = &filters.directory_name {
        conditions.push("(is_dir = 1 AND LOWER(name) LIKE ?)".to_string());
        param_values.push(format!("%{}%", dir_name.to_lowercase()));
    }

    if let (Some(file_name), Some(dir_name)) = (&filters.file_name, &filters.directory_name) {
        conditions.clear();
        param_values.clear();
        conditions.push("(is_dir = 0 AND LOWER(name) LIKE ? AND LOWER(path) LIKE ?)".to_string());
        param_values.push(format!("%{}%", file_name.to_lowercase()));
        param_values.push(format!("%/{}/%", dir_name.to_lowercase()));
    }

    if let Some(plain_text) = &filters.plain_text {
        conditions.push("(LOWER(name) LIKE ? OR LOWER(path) LIKE ?)".to_string());
        param_values.push(format!("%{}%", plain_text.to_lowercase()));
        param_values.push(format!("%{}%", plain_text.to_lowercase()));
    }

    let where_clause = if conditions.is_empty() {
        "1=1".to_string()
    } else {
        conditions.join(" AND ")
    };

    (where_clause, param_values)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_empty_query() {
        let filter = parse_search_query("");
        assert!(filter.file_name.is_none());
        assert!(filter.directory_name.is_none());
        assert!(filter.regex_pattern.is_none());
        assert!(filter.plain_text.is_none());
    }

    #[test]
    fn parse_mixed_file_and_plain_text() {
        let filter = parse_search_query("file:App test");
        assert_eq!(filter.file_name.as_deref(), Some("App"));
        assert!(filter.directory_name.is_none());
        assert_eq!(filter.plain_text.as_deref(), Some("test"));
        assert!(filter.regex_pattern.is_none());
    }

    #[test]
    fn parse_case_insensitive_prefixes() {
        let filter = parse_search_query("FILE:App DIR:src");
        assert_eq!(filter.file_name.as_deref(), Some("App"));
        assert_eq!(filter.directory_name.as_deref(), Some("src"));
    }

    #[test]
    fn parse_invalid_regex_falls_back_to_plain_text() {
        let filter = parse_search_query("[invalid");
        assert!(filter.regex_pattern.is_none());
        assert_eq!(filter.plain_text.as_deref(), Some("[invalid"));
    }

    #[test]
    fn score_prioritizes_exact_match_over_path_match() {
        let exact = compute_score("app.tsx", "/project/src/app.tsx", "app.tsx", false);
        let path_only = compute_score("index.ts", "/project/src/app.tsx", "app.tsx", false);
        assert!(exact > path_only);
    }
}
