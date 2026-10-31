# Skill GitHub gợi ý cho từng phòng ban

Kiểm tra số sao và nội dung trên GitHub trước khi cài; chỉ cài skill bạn đã đọc qua.

| Nguồn | Skill nổi bật | Phòng ban |
|---|---|---|
| anthropics/skills (chính thức) | frontend-design, webapp-testing, mcp-builder, skill-creator, docx/pdf/pptx/xlsx | Designer, Frontend, Tester, BA, PM |
| obra/superpowers | brainstorming, writing-plans, test-driven-development, systematic-debugging, requesting-code-review, verification-before-completion, dispatching-parallel-agents | PM, BA, Backend, Frontend, DevOps, Tester |
| vercel-labs/agent-skills | react-best-practices, web-design-guidelines | Frontend, Designer |
| nextlevelbuilder/ui-ux-pro-max-skill (Đã cài đặt) | ui-ux-pro-max, design-system, ui-styling, design, brand, banner-design, slides | Designer, Frontend |
| trailofbits/skills | rà soát bảo mật, phân tích lỗ hổng | Backend, DevOps, Tester |
| travisvn/awesome-claude-skills, ComposioHQ/awesome-claude-skills | danh mục tham khảo để tìm skill khác | Tất cả |

## Cài đặt (Claude Code)
- Skill đơn: chép thư mục skill vào `.claude/skills/` của dự án (hoặc `~/.claude/skills/`).
- Plugin (ví dụ superpowers): dùng lệnh `/plugin` trong Claude Code theo hướng dẫn trong README của repo.
- Agent: thư mục `.claude/agents/` của gói này, chép vào gốc dự án.

## Cách dùng
Trong Claude Code, nói: "Dùng pm điều phối: <yêu cầu>". PM sẽ gọi ba -> designer -> dev -> tester.
