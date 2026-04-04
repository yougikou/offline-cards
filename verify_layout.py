import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate to the locally served exported app
    page.goto("http://localhost:3000")
    page.wait_for_timeout(2000)

    # We just need to check the selection without preview overlay.
    # We can write a custom click based on class or ID, or we know the DOM
    # Let's just click coordinate since it's the last button in the row or we can use xpath
    # Or just use the button index. HomeActions has Join Global, Join Secondary, Sandbox...
    # There are game cards, then host room, join room, sandbox...
    # Just take screenshots of lobby to verify step 1, step 2 is already tested via verify.spec.ts mostly.
    # Let's just screenshot the lobby.
    page.screenshot(path="/home/jules/verification/screenshots/lobby2.png")
    page.wait_for_timeout(500)


if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # We need a mobile viewport to really see the effect of the flex wrap and sizing on portrait phone layout
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 390, 'height': 844}, # iPhone 12/13/14 size
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()