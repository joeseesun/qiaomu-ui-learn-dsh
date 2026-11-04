# DeepSeek Harness 0.2.2-rc.1 compatibility

Target: official npm @deepseek-ai/dsh@0.2.2-rc.1 on macOS, Node 24.21.0. Upstream requires Node >=24.9.

The previous release is rejected by the host's engines.dsh evaluator. This release adds the exact tested host version, synchronizes DSH peers and accepts Cordis 4.1.0 alongside the previously supported Cordis 4.0 range. Unknown RC/alpha/future releases remain outside the declaration.

Reviewed the official conditional-tools, Cordis loader, projection and composer changes. This plugin does not filter tools through system-prompt/assemble or directly consume the changed projection frames. Existing slot/remote/tool APIs are retained.

Validation: npm run check and npm pack pass. The actual 0.2.2-rc.1 evaluator rejects the old manifest and accepts the candidate; rc.5 remains declared. A fresh official Web profile installs without exemptions, starts and matches every packaged file. UI qualification is in progress; this document will be finalized before release.

This is not an upgrade of the user's Desktop application or daily profile. No data migration. Windows/Linux, model requests and external publishing are outside this compatibility smoke test.

Upstream: https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.1
