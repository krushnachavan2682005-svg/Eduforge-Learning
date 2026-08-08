import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from utils.config import Config

@pytest.fixture(scope="session")
def browser():
    """Initializes and returns a maximized Chrome browser instance for the test session."""
    # Setup Chrome options
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-extensions")
    
    # Initialize WebDriver
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    
    # Set implicit wait as fallback, though we rely on explicit waits
    driver.implicitly_wait(Config.IMPLICIT_WAIT)
    
    yield driver
    
    # Teardown
    driver.quit()
