# Contributing to Stormworks Steam Workshop Manager

Thank you for considering contributing to Stormworks Workshop Manager! We welcome contributions from the community, whether it's bug fixes, new features, translations, or documentation improvements.

---

## 🛠️ How Can You Contribute?

### 1. Reporting Bugs
- Search existing [Issues](https://github.com/macenkodenis/stormworks-workshop-manager/issues) first to make sure the problem hasn't already been reported.
- If not, use the **🐛 Bug Report** template and provide as much detail as possible (operating system, error logs, and reproduction steps).

### 2. Suggesting Features
- Open an Issue with the **💡 Feature Request** template.
- Describe the motivation, how it benefits Stormworks players, and how the user interface could look.

### 3. Submitting Code via Pull Requests (PR)
We encourage direct code contributions! Here is the workflow:

1. **Fork the Repository**:
   Click the **Fork** button on GitHub to create your own copy of the repository.

2. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/stormworks-workshop-manager.git
   cd stormworks-workshop-manager
   ```

3. **Create a new branch**:
   ```bash
   git checkout -b feature/my-cool-feature
   # or
   git checkout -b fix/issue-description
   ```

4. **Develop and Test**:
   - For backend/API changes: ensure python imports and API routes work without errors.
   - For frontend changes: run `npm run build` inside `frontend/` to make sure Vite compiles cleanly.
   - For desktop changes: test with `./run_desktop.sh` or `python run_desktop.py`.

5. **Commit your changes**:
   Write clear, descriptive commit messages (e.g. `feat: add support for custom vehicle thumbnails` or `fix: handle edge case in save.xml parsing`).

6. **Push and Open a Pull Request**:
   Push the branch to your fork:
   ```bash
   git push origin feature/my-cool-feature
   ```
   Then navigate to the original repository and click **"Compare & pull request"**.

---

## 📜 Code Style & Principles
- **License**: All contributions will be licensed under the project's [GNU General Public License v3.0](LICENSE).
- **Safety First**: Any logic manipulating Stormworks game files (such as `save.xml`) must verify the game process is closed to prevent save file corruption.
- **Performance**: Maintain smooth rendering for players with 1000+ workshop subscriptions (use indexing, virtualized lists, and asynchronous background tasks).

Thank you for helping make the Stormworks experience better for everyone! 🚀
