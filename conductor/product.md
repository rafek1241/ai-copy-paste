# Initial Concept
My plan for this application is to make cross-platform desktop application where user will be able to select some files and provide the prompt that in a result will create a single text in the clipboard that I will be able to copy-paste to sites like gemini.google.com or chatgpt.com to the textarea where all the context (text from files and the prompt itself) to make chats working on them with all the context in it. It is just to make life easier for the people who wants to use it.

# Product Definition - AI Context Collector

## Vision
To provide a cross-platform desktop application that simplifies the process of gathering and organizing code context for AI assistants. Users can select files and provide prompts, resulting in a single, comprehensive text in the clipboard ready for pasting into AI chat interfaces like Gemini or ChatGPT.

## Target Audience
- **Developers**: Who frequently use AI coding assistants and need to provide large amounts of code context.
- **Data Scientists & Researchers**: Working with code and text who need to leverage AI for analysis and generation.
- **Technical Writers**: Who need to compile information from various sources into a single prompt for AI assistance.
- **AI Enthusiasts**: Who want to experiment with AI models and need an efficient way to gather context.
- **Privacy-conscious Users**: Who prefer an offline-first solution to protect sensitive information.
- **Cross-platform Users**: Who require a tool that works seamlessly across Windows, macOS, and Linux.

## Core Goals

- Enable users to quickly gather and organize code context for AI assistants.
- Support cross-platform usage across Windows, macOS, and Linux.
- Provide a seamless and efficient user experience, even with large codebases.
- Ensure privacy and security through an offline-first approach.

## Key Features
-- **File tree view**: A responsive UI for selecting files and directories, with support for large codebases and `.gitignore` rules. In the backend, it will use SQLite to index files for fast traversal and searching, but the user will see file tree with virtual scrolling to save memory and keep the UI responsive, and load-on-demand content when user expand the directory. All interactions with the file tree will be designed to be smooth and efficient, allowing users to quickly find and select the files they need without any lag or freezing, even in large projects. Any action on files will deliver signals to the backend to update the token count, mark what is selected for index, load files if needed, index new files when drag-drop on app (or through file dialog). 

- **Prompt Assembly**: A simple and intuitive interface for assembling prompts with selected files and custom instructions. Users can easily add or remove files, reorder them, and input custom instructions. The application will provide real-time token counting for both file content and custom instructions using `gpt-tokenizer`, allowing users to manage their context effectively. Once the prompt is assembled, users can copy it to the clipboard with a single click, receiving live feedback and success notifications. In the settings, users can customize token limits and other preferences to tailor the prompt assembly process to their needs. We can also enable/disable some features like token counter, gitignore support, templates etc.

- **Search & Filter**: A powerful search and filter functionality to quickly find specific files or content within the selected files. This will help users to efficiently manage large codebases and focus on the relevant context for their AI prompts. It allows you to search through indexed files and filter them by name, extension, or content or order by name or size. It will also support regex search and search by the type (dir/file). 

- **Automation**: Support for automating executing the prompts in specific pages like Gemini or ChatGPT. This can be achieved through browser extensions or desktop automation tools, allowing users to seamlessly transfer their assembled prompts into AI chat interfaces and start conversations without manual copy-pasting. This feature will enhance the user experience by streamlining the workflow and reducing friction when using AI assistants. 

- **History**: A click to "copy-to-clipboard" button should creates a new entry in the history with the prompt, selected files, and timestamp. Users can view their history of assembled prompts, search through them, and easily copy previous prompts back to the clipboard for reuse. Indexed files from the past should NOT be stored in the history, only general information about selected files (like name, path, size) and the prompt itself. This will allow users to keep track of their past interactions and easily access previous prompts without worrying about sensitive information being stored.

- **Sensitive Data Protection**: Automatically detect and redact sensitive information from the selected files before including them in the prompt. This can be achieved through pattern recognition and user-defined rules, ensuring that sensitive data is not exposed when sharing prompts with AI assistants. Users can customize the redaction settings to suit their specific needs and ensure that their privacy is maintained.

## Constraints & Requirements
- **Cross-platform**: Support for Windows, macOS, and Linux.
- **Offline-first**: No data sent to external servers, protecting sensitive code and information.
- **Performance**: Efficiently handle large codebases without UI freezing.
- **User-friendly**: Intuitive interface for both technical and non-technical users.
- **Security**: Ensure that all data is stored securely and that the application does not expose sensitive information.