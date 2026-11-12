# DeepSeek Harness 0.2.2-rc.2 verification

Verified 2026-11-12 (America/Los_Angeles). Product 0.1.5, baseline v0.1.4 / `ad7dffddcd08fd9878db9d8123559fc6540a77bb`.

The old public tgz is rejected by the unmodified official rc.2 installer in an empty profile. This release explicitly adds only `0.2.2-rc.2` to the existing engines/DSH peers; untested future rc.3 remains rejected. Lock root metadata and bundled product identity are synchronized; the locked dependency graph is unchanged.

Upstream: [official rc.2 release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.2). The official compatibility evaluator still gives engines.dsh precedence. Reviewed the actual sidebar slot, layout, Typert remote/gateway and tool contracts. The sidebar.panellist registration remains supported; these products do not wrap the changed session append API or depend on the old host overlay positioning API. RSS defines tools through defineTool and does not inspect obsolete error categories. No exemption is used.

## Verified

- Clean `npm ci`, existing `npm run check`, build and package audit pass.
- Official signed macOS arm64 rc.2 Desktop bundled CLI; signature and exact version rechecked. A separate DSH_HOME/workspace and web profile are used, with no daily-host changes.
- Candidate plugin install, composed configuration, host startup and every packaged installed file compared by size/SHA-256.
- 灵感图库、UI 词典、文本乱序词条与交互标本打开；通过真实界面保存 rc2-ui-learn.md，独立读取磁盘核对正文。

## Limits and recovery

未遍历全部词条、外部设计站点或测验。 Windows/Linux and older host versions were not rerun; retained older declarations are not new runtime evidence. No production publishing or paid model calls. Existing migration branches and primary-workspace edits are preserved.

Previous version remains available at [the prior release](https://github.com/joeseesun/qiaomu-ui-learn-dsh/releases/tag/v0.1.4). Roll back by installing that tgz with the matching prior host; no data-format migration is introduced. Release assets and the independently downloaded public package are checked separately after merge.
