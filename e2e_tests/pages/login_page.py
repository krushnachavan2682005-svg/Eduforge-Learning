from selenium.webdriver.common.by import By
from pages.base_page import BasePage
from utils.config import Config

class LoginPage(BasePage):
    """Page object for the Login Page."""
    
    # --- Locators ---
    # Force locators to strictly match <input> tags
    EMAIL_INPUT = (By.XPATH, "//input[@type='email' or @formcontrolname='email' or @name='email']")
    PASSWORD_INPUT = (By.XPATH, "//input[@type='password' or @formcontrolname='password' or @name='password']")
    LOGIN_BUTTON = (By.XPATH, "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'login') or @type='submit']")
    LOGOUT_MENU_ITEM = (By.XPATH, "//span[contains(text(), 'Logout')]")
    LOGOUT_CONFIRM_BTN = (By.XPATH, "//button[contains(text(), 'Yes')]")

    def __init__(self, driver):
        super().__init__(driver)

    def go_to(self):
        """Navigates to the base URL where the login page should be."""
        self.navigate_to(Config.BASE_URL)

    def login(self, email, password):
        """Performs the login action using the provided credentials."""
        self.send_keys(self.EMAIL_INPUT, email)
        self.send_keys(self.PASSWORD_INPUT, password)
        self.click(self.LOGIN_BUTTON)

    def logout(self):
        """Performs the logout action if the button is present."""
        self.click(self.LOGOUT_MENU_ITEM)
        # Wait for and click confirmation
        import time
        time.sleep(1)
        self.click(self.LOGOUT_CONFIRM_BTN)
