from pathlib import Path
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = "http://127.0.0.1:4173/"
ARTIFACTS = Path("artifacts/worker-browser-qa")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

options = Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-background-networking")
options.add_argument("--disable-component-update")
options.add_argument("--disable-default-apps")
options.add_argument("--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 20)


def settled():
    wait.until(lambda browser: browser.execute_script("return document.readyState") == "complete")
    wait.until(lambda browser: len(browser.find_elements(By.CSS_SELECTOR, ".worker-bottom-nav button")) == 5)
    time.sleep(0.4)


try:
    for width, height in [(320, 720), (390, 844), (673, 841), (844, 390)]:
        driver.set_window_size(width, height)
        driver.get(BASE_URL)
        settled()

        assert driver.title == "NOSMO Work · Ask Nexus", driver.title
        labels = [element.text.strip() for element in driver.find_elements(By.CSS_SELECTOR, ".worker-bottom-nav button")]
        assert labels == ["Worker Card", "Documents", "Jobs", "Apps", "Settings"], labels
        assert "NOSMO Work" in driver.find_element(By.TAG_NAME, "body").text
        assert len(driver.find_elements(By.CSS_SELECTOR, ".availability-led-trigger")) == 1
        assert not driver.find_elements(By.CSS_SELECTOR, ".nec-launcher, .nec-overlay")
        assert "Person Card Freeware" not in driver.page_source
        assert "Emergency Core" not in driver.page_source

        overflow = driver.execute_script(
            "return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth"
        )
        assert overflow <= 1, (width, height, overflow)
        driver.save_screenshot(str(ARTIFACTS / f"worker-{width}x{height}.png"))

    driver.set_window_size(390, 844)
    driver.get(BASE_URL)
    settled()

    ask_nexus = driver.find_element(By.CSS_SELECTOR, '[aria-label="Open Ask Nexus"]')
    ask_nexus.click()
    wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, '[aria-label="Close Ask Nexus"]'))
    query = driver.find_element(By.CSS_SELECTOR, ".nexus-search-window .unified-search-box input")
    assert query.is_enabled()

    driver.find_element(By.CSS_SELECTOR, '[aria-label="Close Ask Nexus"]').click()
    driver.find_elements(By.CSS_SELECTOR, ".worker-bottom-nav button")[0].click()
    wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, ".availability-led-trigger"))
    driver.find_element(By.CSS_SELECTOR, ".availability-led-trigger").click()
    status_labels = [
        element.text.splitlines()[0].strip()
        for element in driver.find_elements(By.CSS_SELECTOR, ".availability-menu-popover b")
    ]
    assert status_labels == ["Available", "Busy", "Ready on date"], status_labels
    driver.find_elements(By.CSS_SELECTOR, '.availability-menu-popover [role="menuitemradio"]')[1].click()
    time.sleep(0.4)
    driver.refresh()
    settled()
    driver.find_elements(By.CSS_SELECTOR, ".worker-bottom-nav button")[0].click()
    wait.until(lambda browser: "Busy" in browser.find_element(By.CSS_SELECTOR, ".availability-led-trigger").text)

    driver.find_elements(By.CSS_SELECTOR, ".worker-bottom-nav button")[3].click()
    wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, ".nexus-command-head h1"))
    assert len(driver.find_elements(By.CSS_SELECTOR, '[aria-label="Work tools"] .nexus-command-module')) == 4

    driver.find_elements(By.CSS_SELECTOR, ".worker-bottom-nav button")[4].click()
    wait.until(lambda browser: browser.find_elements(By.CSS_SELECTOR, ".settings-version"))
    theme_summary = driver.find_element(By.CSS_SELECTOR, ".theme-setting summary")
    theme_summary.click()
    assert len(driver.find_elements(By.CSS_SELECTOR, ".theme-presets button")) == 6
    theme_summary.click()
    wait.until(lambda browser: browser.find_element(By.CSS_SELECTOR, ".theme-setting").get_attribute("open") is None)
    driver.find_element(By.CSS_SELECTOR, ".language-setting summary").click()
    assert len(driver.find_elements(By.CSS_SELECTOR, ".language-options button")) >= 3

    print("NOSMO_WORK_BROWSER_QA_PASS")
finally:
    driver.quit()
