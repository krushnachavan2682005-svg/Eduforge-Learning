from selenium.webdriver.common.by import By
from pages.base_page import BasePage
from utils.config import Config

class LoginPage(BasePage):
    """Page object for the Login Page."""
    
    # --- Locators ---
    # These may need to be updated to match the exact Angular DOM attributes
    EMAIL_INPUT = (By.CSS_SELECTOR, "input[type='email'], input[name='email'], input[formcontrolname='email']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[type='password'], input[name='password'], input[formcontrolname='password']")
    LOGIN_BUTTON = (By.XPATH, "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'login') or @type='submit']")
    LOGOUT_BUTTON = (By.XPATH, "//button[contains(text(), 'Logout')]")

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
        self.click(self.LOGOUT_BUTTON)
