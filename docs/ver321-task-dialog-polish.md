# Ver.321 task dialog polish

- Preserve Ver.320 checklist presentation.
- Keep comments visible only on the Comments tab; History and Related/Organize stay isolated.
- Move task metadata to the full-width tail of the Details layout, after checklist/content review sections.
- Rename the outer dialog heading to `タスク詳細` or `タスク編集` for existing tasks.
- Mount the mention picker inside an open task dialog so it remains above the modal top layer.
- Keep five secondary task actions on one desktop row even when pin/favorite labels become longer.
- Release remains 279; no Firebase write path or persistence logic changes.
- Rollback: `backup/ver320-before-task-dialog-polish-v321`.
