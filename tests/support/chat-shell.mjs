/** Explicit actions for the conversation shell; original behavioral assertions remain intact. */
export async function openCodeNavigation(page) {
  const details = page.locator(".compact-navigation");
  if ((await details.getAttribute("open")) === null)
    await details.locator(":scope > summary").click();
}
export async function openSourceDrawer(page) {
  const button = page
    .locator(".inspector")
    .getByRole("button", { name: /^(View source|查看源码)$/ });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
export async function openAdvancedNavigation(page) {
  const button = page.getByRole("button", {
    name: /^(Advanced controls|高级控件)$/,
  });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
}
