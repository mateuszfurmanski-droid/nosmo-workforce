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
    driver.set_window_size(673, 841)
    wait.until(lambda browser: browser.execute_script("return innerWidth") >= 650)
    time.sleep(0.4)
    fold_metrics = driver.execute_script(
        "const r=document.querySelector('.work').getBoundingClientRect();"
        "return {x:r.x,width:r.width,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth}"
    )
    assert fold_metrics["x"] <= 1, fold_metrics
    assert fold_metrics["width"] >= 649, fold_metrics
    assert fold_metrics["overflow"] <= 1, fold_metrics
    assert len(driver.find_elements(By.CSS_SELECTOR, ".worker-bottom-nav button")) == 5
    driver.save_screenshot(str(ARTIFACTS / "worker-live-fold-transition.png"))

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

    install = driver.find_element(By.ID, "worker-pwa-install")
    wait.until(lambda browser: install.get_attribute("data-state") != "checking")
    assert install.get_attribute("data-state") in {"ready", "manual", "installed"}
    scope = driver.execute_async_script(
        "const done=arguments[0];navigator.serviceWorker.ready.then(r=>done(r.scope)).catch(e=>done('ERR:'+e.message));"
    )
    assert scope == BASE_URL, scope
    cache_keys = driver.execute_async_script(
        "const done=arguments[0];caches.keys().then(done).catch(()=>done([]));"
    )
    assert any(key.startswith("nosmo-work-v10102") for key in cache_keys), cache_keys
    manifest = driver.execute_async_script(
        "const done=arguments[0];fetch('/manifest.webmanifest').then(r=>r.json()).then(done).catch(e=>done({error:e.message}));"
    )
    assert manifest["name"] == "NOSMO Work", manifest
    assert manifest["display"] == "standalone", manifest
    assert {icon["sizes"] for icon in manifest["icons"]} >= {"192x192", "512x512"}, manifest

    driver.set_network_conditions(offline=True, latency=0, download_throughput=0, upload_throughput=0)
    driver.refresh()
    settled()
    assert "NOSMO Work" in driver.find_element(By.TAG_NAME, "body").text
    driver.set_network_conditions(offline=False, latency=0, download_throughput=-1, upload_throughput=-1)

    print("NOSMO_WORK_BROWSER_QA_PASS")
finally:
    try:
        driver.set_network_conditions(offline=False, latency=0, download_throughput=-1, upload_throughput=-1)
    except Exception:
        pass
    driver.quit()
