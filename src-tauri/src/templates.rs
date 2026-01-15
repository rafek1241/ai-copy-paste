use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub template: String,
}

/// Get built-in prompt templates
pub fn get_builtin_templates() -> Vec<PromptTemplate> {
    vec![
        PromptTemplate {
            id: "agent".to_string(),
            name: "AI Agent".to_string(),
            description: "General purpose AI agent task template".to_string(),
            template: r#"You are an expert software engineer tasked with analyzing and working with the following codebase.

{{custom_instructions}}

Here are the relevant files:

{{files}}

Please analyze the code and provide your insights."#.to_string(),
        },
        PromptTemplate {
            id: "planning".to_string(),
            name: "Planning".to_string(),
            description: "Project planning and architecture template".to_string(),
            template: r#"You are a technical architect reviewing the following codebase for planning purposes.

{{custom_instructions}}

Please review these files and provide:
1. Architecture overview
2. Key components and their relationships
3. Potential improvements or concerns
4. Implementation recommendations

Files:

{{files}}"#.to_string(),
        },
        PromptTemplate {
            id: "debugging".to_string(),
            name: "Debugging".to_string(),
            description: "Code debugging and troubleshooting template".to_string(),
            template: r#"You are a debugging expert analyzing the following code for issues.

{{custom_instructions}}

Please review the code and:
1. Identify potential bugs or issues
2. Suggest fixes and improvements
3. Explain root causes
4. Recommend best practices

Code files:

{{files}}"#.to_string(),
        },
        PromptTemplate {
            id: "review".to_string(),
            name: "Code Review".to_string(),
            description: "Code review template".to_string(),
            template: r#"You are performing a code review on the following files.

{{custom_instructions}}

Please provide:
1. Code quality assessment
2. Potential issues or improvements
3. Security concerns
4. Performance considerations
5. Maintainability suggestions

Files to review:

{{files}}"#.to_string(),
        },
        PromptTemplate {
            id: "documentation".to_string(),
            name: "Documentation".to_string(),
            description: "Generate documentation for code".to_string(),
            template: r#"You are a technical writer creating documentation for the following codebase.

{{custom_instructions}}

Please generate comprehensive documentation including:
1. Overview and purpose
2. Key functions and classes
3. Usage examples
4. API documentation

Source files:

{{files}}"#.to_string(),
        },
        PromptTemplate {
            id: "testing".to_string(),
            name: "Testing".to_string(),
            description: "Generate test cases for code".to_string(),
            template: r#"You are a QA engineer creating test cases for the following code.

{{custom_instructions}}

Please generate:
1. Unit test cases
2. Edge cases to consider
3. Integration test scenarios
4. Test data examples

Code to test:

{{files}}"#.to_string(),
        },
    ]
}

/// Build a prompt from template, custom instructions, and file contents
pub fn build_prompt(
    template_id: &str,
    custom_instructions: Option<&str>,
    file_contents: &[(String, String)], // (path, content) pairs
) -> Result<String, String> {
    let templates = get_builtin_templates();
    let template = templates
        .iter()
        .find(|t| t.id == template_id)
        .ok_or_else(|| format!("Template not found: {}", template_id))?;

    let mut prompt = template.template.clone();

    // Replace custom instructions
    let instructions = custom_instructions.unwrap_or("No additional instructions provided.");
    prompt = prompt.replace("{{custom_instructions}}", instructions);

    // Build files section
    let files_section = if file_contents.is_empty() {
        "No files provided.".to_string()
    } else {
        file_contents
            .iter()
            .map(|(path, content)| {
                format!(
                    "--- {} ---\n{}\n",
                    path,
                    content
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    prompt = prompt.replace("{{files}}", &files_section);

    Ok(prompt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_builtin_templates() {
        let templates = get_builtin_templates();
        assert!(templates.len() >= 4);
        assert!(templates.iter().any(|t| t.id == "agent"));
        assert!(templates.iter().any(|t| t.id == "planning"));
        assert!(templates.iter().any(|t| t.id == "debugging"));
        assert!(templates.iter().any(|t| t.id == "review"));
    }

    #[test]
    fn test_build_prompt() {
        let file_contents = vec![
            ("main.rs".to_string(), "fn main() {}".to_string()),
            ("lib.rs".to_string(), "pub fn foo() {}".to_string()),
        ];

        let prompt = build_prompt("agent", Some("Fix bugs"), &file_contents).unwrap();

        assert!(prompt.contains("Fix bugs"));
        assert!(prompt.contains("main.rs"));
        assert!(prompt.contains("fn main()"));
        assert!(prompt.contains("lib.rs"));
        assert!(prompt.contains("pub fn foo()"));
    }

    #[test]
    fn test_build_prompt_invalid_template() {
        let result = build_prompt("invalid", None, &[]);
        assert!(result.is_err());
    }
}
