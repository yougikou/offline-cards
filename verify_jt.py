import time
from playwright.sync_api import sync_playwright

def verify_feature(page):
    page.goto("http://localhost:8081")
    page.wait_for_timeout(2000)

    page.wait_for_selector('div')

    # Change to English
    # Sometimes it takes a bit to load
    page.wait_for_timeout(2000)

    # Select language based on generic role pattern
    page.get_by_role("button", name="🌐 中文 ▼").click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="English").click()
    page.wait_for_timeout(1000)

    # Select Jiangsu Taopai
    page.get_by_text("Jiangsu Taopai").click()
    page.wait_for_timeout(500)

    # Enter Sandbox Testing
    page.get_by_text("Enter Local Sandbox").click()
    page.wait_for_timeout(2000)

    # Press period to hide debug panel just in case
    page.keyboard.press('.')
    page.wait_for_timeout(500)

    page.screenshot(path="verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="video",
            viewport={'width': 375, 'height': 812}
        )
        page = context.new_page()
        try:
            verify_feature(page)
        finally:
            context.close()
            browser.close()
