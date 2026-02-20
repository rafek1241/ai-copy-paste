use super::SensitivePattern;

pub fn get_builtin_patterns() -> Vec<SensitivePattern> {
    vec![
        SensitivePattern {
            id: "aws_access_key".into(),
            name: "AWS Access Key".into(),
            pattern: r"(?:^|[^A-Za-z0-9/+=])((AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16})(?:[^A-Za-z0-9/+=]|$)".into(),
            placeholder: "[AWS_ACCESS_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "aws_secret_key".into(),
            name: "AWS Secret Key".into(),
            pattern: r#"(?i)(?:aws_secret_access_key|aws_secret_key|secret_key)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?"#.into(),
            placeholder: "[AWS_SECRET_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "github_token".into(),
            name: "GitHub Token".into(),
            pattern: r"(ghp_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{22,255})".into(),
            placeholder: "[GITHUB_TOKEN]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "openai_key".into(),
            name: "OpenAI API Key".into(),
            pattern: r"(sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{40,})".into(),
            placeholder: "[OPENAI_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "generic_api_key".into(),
            name: "Generic API Key".into(),
            pattern: r#"(?i)(?:api[_-]?key|apikey)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?"#.into(),
            placeholder: "[API_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "generic_secret".into(),
            name: "Generic Secret".into(),
            pattern: r#"(?i)(?:secret|secret[_-]?key|client[_-]?secret)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{16,})['"]?"#.into(),
            placeholder: "[SECRET]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "azure_key".into(),
            name: "Azure Subscription Key".into(),
            pattern: r#"(?i)(?:azure|subscription)[_-]?key\s*[=:]\s*['"]?([A-Fa-f0-9]{32})['"]?"#.into(),
            placeholder: "[AZURE_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "google_api_key".into(),
            name: "Google API Key".into(),
            pattern: r"AIza[0-9A-Za-z_-]{35}".into(),
            placeholder: "[GOOGLE_API_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "API Keys & Secrets".into(),
        },
        SensitivePattern {
            id: "password_field".into(),
            name: "Password in Config".into(),
            pattern: r#"(?i)(?:password|passwd|pwd)\s*[=:]\s*['"]?([^\s'"]{4,})['"]?"#.into(),
            placeholder: "[PASSWORD]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },
        SensitivePattern {
            id: "bearer_token".into(),
            name: "Bearer Token".into(),
            pattern: r"(?i)Bearer\s+([A-Za-z0-9_\-\.]+)".into(),
            placeholder: "[BEARER_TOKEN]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },
        SensitivePattern {
            id: "basic_auth".into(),
            name: "Basic Auth".into(),
            pattern: r"(?i)Basic\s+([A-Za-z0-9+/=]{10,})".into(),
            placeholder: "[BASIC_AUTH]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },
        SensitivePattern {
            id: "jwt_token".into(),
            name: "JWT Token".into(),
            pattern: r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-]+".into(),
            placeholder: "[JWT_TOKEN]".into(),
            enabled: true,
            builtin: true,
            category: "Authentication".into(),
        },
        SensitivePattern {
            id: "mysql_conn".into(),
            name: "MySQL Connection String".into(),
            pattern: r#"mysql://[^\s']+"#.into(),
            placeholder: "[MYSQL_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },
        SensitivePattern {
            id: "postgres_conn".into(),
            name: "PostgreSQL Connection String".into(),
            pattern: r#"postgres(?:ql)?://[^\s']+"#.into(),
            placeholder: "[POSTGRES_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },
        SensitivePattern {
            id: "mongodb_conn".into(),
            name: "MongoDB Connection String".into(),
            pattern: r#"mongodb(?:\+srv)?://[^\s']+"#.into(),
            placeholder: "[MONGODB_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },
        SensitivePattern {
            id: "redis_conn".into(),
            name: "Redis Connection String".into(),
            pattern: r#"redis://[^\s']+"#.into(),
            placeholder: "[REDIS_CONNECTION_STRING]".into(),
            enabled: true,
            builtin: true,
            category: "Connection Strings".into(),
        },
        SensitivePattern {
            id: "email".into(),
            name: "Email Address".into(),
            pattern: r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}".into(),
            placeholder: "[EMAIL]".into(),
            enabled: false,
            builtin: true,
            category: "PII".into(),
        },
        SensitivePattern {
            id: "phone_us".into(),
            name: "US Phone Number".into(),
            pattern: r"(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}".into(),
            placeholder: "[PHONE]".into(),
            enabled: false,
            builtin: true,
            category: "PII".into(),
        },
        SensitivePattern {
            id: "ssn".into(),
            name: "US Social Security Number".into(),
            pattern: r"\b\d{3}-\d{2}-\d{4}\b".into(),
            placeholder: "[SSN]".into(),
            enabled: true,
            builtin: true,
            category: "PII".into(),
        },
        SensitivePattern {
            id: "credit_card".into(),
            name: "Credit Card Number".into(),
            pattern: r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b".into(),
            placeholder: "[CREDIT_CARD]".into(),
            enabled: true,
            builtin: true,
            category: "PII".into(),
        },
        SensitivePattern {
            id: "ipv4".into(),
            name: "IPv4 Address".into(),
            pattern: r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b".into(),
            placeholder: "[IP_ADDRESS]".into(),
            enabled: false,
            builtin: true,
            category: "Network".into(),
        },
        SensitivePattern {
            id: "private_key".into(),
            name: "Private Key Block".into(),
            pattern: r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----".into(),
            placeholder: "[PRIVATE_KEY]".into(),
            enabled: true,
            builtin: true,
            category: "Private Keys".into(),
        },
        SensitivePattern {
            id: "env_secret".into(),
            name: "Secret in Env Variable".into(),
            pattern: r#"(?i)(?:^|export\s+)[A-Z_]*(?:SECRET|PASSWORD|TOKEN|KEY|CREDENTIALS|AUTH)[A-Z_]*\s*=\s*['"]?([^\s'"]+)['"]?"#.into(),
            placeholder: "[ENV_SECRET]".into(),
            enabled: true,
            builtin: true,
            category: "Environment Variables".into(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_patterns_not_empty() {
        let patterns = get_builtin_patterns();
        assert!(
            patterns.len() > 10,
            "Should have at least 10 built-in patterns"
        );
    }

    #[test]
    fn test_all_patterns_have_unique_ids() {
        let patterns = get_builtin_patterns();
        let mut ids: Vec<&str> = patterns.iter().map(|p| p.id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), patterns.len(), "Pattern IDs must be unique");
    }

    #[test]
    fn test_all_builtin_patterns_are_valid_regex() {
        let patterns = get_builtin_patterns();
        for pattern in &patterns {
            let result = regex::Regex::new(&pattern.pattern);
            assert!(
                result.is_ok(),
                "Pattern '{}' has invalid regex: {}",
                pattern.id,
                pattern.pattern
            );
        }
    }

    #[test]
    fn test_all_patterns_are_builtin() {
        let patterns = get_builtin_patterns();
        for pattern in &patterns {
            assert!(
                pattern.builtin,
                "Pattern '{}' should be marked builtin",
                pattern.id
            );
        }
    }
}
