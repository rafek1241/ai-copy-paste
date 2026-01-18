# Initial Concept
My plan for this application is to make cross-platform desktop application where user will be able to select some files and provide the prompt that in a result will create a single text in the clipboard that I will be able to copy-paste to sites like gemini.google.com or chatgpt.com to the textarea where all the context (text from files and the prompt itself) to make chats working on them with all the context in it. It is just to make life easier for the people who wants to use it.

# Product Definition - AI Context Collector

## Vision
To provide a cross-platform desktop application that simplifies the process of gathering and organizing code context for AI assistants. Users can select files and provide prompts, resulting in a single, comprehensive text in the clipboard ready for pasting into AI chat interfaces like Gemini or ChatGPT.

## Target Audience
- **Developers**: Who frequently use AI coding assistants and need to provide large amounts of code context.
- **Data Scientists & Researchers**: Working with code and text who need to leverage AI for analysis and generation.

## Core Goals
- Make life easier for people using AI assistants by automating the context-gathering process.
- Ensure privacy and security through an offline-first approach.
- Provide a responsive and efficient user experience, even with large projects.

## Key Features
- **File selection and indexing**: Support for ignoring files (e.g., .gitignore) to focus on relevant code.
- **Live token counting**: Immediate feedback on the prompt size to ensure it fits within AI model limits.
- **Prompt assembly**: Combining file contents and user instructions into a single, well-formatted string.
- **Universal File Access**: Works from any location with any files, not limited to a specific codebase.
- **Drag & Drop**: Support for dragging and dropping extra files or directories into the file tree for immediate access and selection.

## Constraints & Requirements
- **Cross-platform**: Support for Windows, macOS, and Linux.
- **Offline-first**: No data sent to external servers, protecting sensitive code and information.
- **Performance**: Efficiently handle large codebases without UI freezing.

## Visual Style & UX
- **Minimalist & Utility-focused**: A clean, native-feeling interface that stays out of the way and prioritizes functionality.
