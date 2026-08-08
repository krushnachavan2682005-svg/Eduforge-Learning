from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from utils.config import Config
import logging

class BasePage:
    """Base class for all page objects, providing wrapper methods for common Selenium actions with explicit waits."""
    
    def __init__(self, driver):
        self.driver = driver
        self.timeout = Config.EXPLICIT_WAIT
        self.wait = WebDriverWait(self.driver, self.timeout)

    def navigate_to(self, url):
        """Navigates to the specified URL."""
        self.driver.get(url)

    def wait_for_element_visible(self, locator):
        """Waits for an element to be visible on the DOM."""
        try:
            return self.wait.until(EC.visibility_of_element_located(locator))
        except TimeoutException:
            logging.error(f"Element {locator} not visible after {self.timeout} seconds.")
            raise

    def wait_for_element_clickable(self, locator):
        """Waits for an element to be clickable."""
        try:
            return self.wait.until(EC.element_to_be_clickable(locator))
        except TimeoutException:
            logging.error(f"Element {locator} not clickable after {self.timeout} seconds.")
            raise

    def click(self, locator):
        """Waits for an element to be clickable and then clicks it."""
        element = self.wait_for_element_clickable(locator)
        element.click()

    def send_keys(self, locator, text):
        """Waits for an element to be visible, clears it, and inputs text."""
        element = self.wait_for_element_visible(locator)
        element.clear()
        element.send_keys(text)

    def get_text(self, locator):
        """Waits for an element to be visible and returns its text."""
        element = self.wait_for_element_visible(locator)
        return element.text

    def is_element_present(self, locator):
        """Checks if an element is present in the DOM (does not need to be visible)."""
        try:
            self.wait.until(EC.presence_of_element_located(locator))
            return True
        except TimeoutException:
            return False
