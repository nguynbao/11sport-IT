# Dự án bán hàng 11 Sport

## Cấu trúc
- `server/` : API, database, nghiệp vụ (đơn hàng, sản phẩm, kho, thanh toán, khuyến mãi)
- `web/`    : website bán hàng cho khách (danh mục, tìm kiếm, giỏ hàng, checkout, tài khoản)
- `cms/`    : trang quản trị (sản phẩm, đơn hàng, khách hàng, banner, bài viết, báo cáo)

## Quy tắc chung cho mọi agent
1. Trả lời bằng tiếng Việt, ngắn gọn, đi thẳng vào việc.
2. Trước khi làm: đọc code hiện có, KHÔNG đoán stack. Nếu thiếu thông tin thì hỏi BA/PM.
3. Mọi thay đổi chạm API phải cập nhật hợp đồng API (`docs/api-contract.md`) trước khi code.
4. Không commit secret/.env. Không chạy lệnh phá hủy (drop DB, force push) khi chưa được PM duyệt.
5. Mỗi agent kết thúc bằng một "Phiếu bàn giao" theo mẫu trong prompt của mình.
6. Thông tin liên quan thanh toán, dữ liệu khách hàng: luôn xét bảo mật trước.

## Luồng làm việc & Hệ thống Subagents (11 Sport)
Luồng chuẩn: `pm` -> `ba` -> `designer` -> `backend-dev` -> `frontend-dev` (`devops` song song) -> `tester` -> `pm`

Danh sách các agent chuyên trách (đặt tại `.agents/agents/` và `.claude/agents/`, đồng thời có sẵn dưới dạng Skills tại `.agents/skills/`):
- `pm`: Quản lý dự án 11 Sport (`.agents/agents/pm.md`) — Dùng ĐẦU TIÊN cho mọi yêu cầu mới hoặc điều phối.
- `ba`: Business Analyst 11 Sport (`.agents/agents/ba.md`) — Làm rõ yêu cầu, viết user story, AC (`docs/requirements/`).
- `designer`: UI/UX Designer 11 Sport (`.agents/agents/designer.md`) — Thiết kế luồng, wireframe, design system (`docs/design/`).
- `backend-dev`: Backend Developer 11 Sport (`.agents/agents/backend-dev.md`) — Thiết kế DB, viết API trong `server/`, cập nhật `docs/api-contract.md`.
- `frontend-dev`: Frontend Developer 11 Sport (`.agents/agents/frontend-dev.md`) — Dựng giao diện `web/` và `cms/`, tích hợp API.
- `devops`: DevOps Engineer 11 Sport (`.agents/agents/devops.md`) — Docker, CI/CD, môi trường, hạ tầng (`docs/devops/`).
- `tester`: QA/Tester 11 Sport (`.agents/agents/tester.md`) — Kiểm thử toàn diện, lập test case (`docs/test/`), báo lỗi (`docs/test/bugs.md`).

Khi người dùng yêu cầu "Dùng pm điều phối: <yêu cầu>" hoặc gọi tên bất kỳ agent nào, hãy đọc file cấu hình của agent tương ứng trong `.agents/agents/<ten-agent>.md` (hoặc dùng `define_subagent` / `invoke_subagent` để khởi chạy subagent đó) và tuân thủ nghiêm ngặt quy trình bàn giao.

## Thư mục tài liệu
- `docs/requirements/` (BA)
- `docs/design/` (Design)
- `docs/api-contract.md` (Backend)
- `docs/devops/` (DevOps)
- `docs/test/` (Tester)
- `docs/status.md` (PM)

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- CLI binary location: `~/.local/bin/graphify` (always prefix shell commands with `export PATH="$HOME/.local/bin:$PATH"` or run `sh scripts/pre-commit-graphify.sh` in non-interactive subshells).
- When `graphify-out/graph.json` exists, run `PATH="$HOME/.local/bin:$PATH" graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- Dirty `graphify-out/` files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `sh scripts/pre-commit-graphify.sh` (or `PATH="$HOME/.local/bin:$PATH" graphify update . --force`) to keep the graph current (AST-only, no API cost).
- A committed `graphify-out/graph.json` is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
