// @ts-check
const {
  test, expect,
} = require('./helpers');

test('앱이 열리고 제목과 세 컬럼이 보인다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Kanban');
  await expect(page.getByRole('heading', { level: 1, name: 'Kanban' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['To-Do', 'In-Progress', 'Done']);
});
