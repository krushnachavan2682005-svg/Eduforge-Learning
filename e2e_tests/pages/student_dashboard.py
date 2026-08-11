from selenium.webdriver.common.by import By
from pages.base_page import BasePage

class StudentDashboard(BasePage):
    """Page object for the Student Dashboard and interactions."""
    
    # --- Locators ---
    PENDING_TESTS_TAB = (By.XPATH, "//a[contains(@href, '/student/tests') or contains(text(), 'Tests')]")
    START_ASSESSMENT_BTN = (By.XPATH, "//button[contains(text(), 'Start Test')]")
    
    # Attempting the test
    # Assuming there are radio buttons or text areas for answers
    FIRST_QUESTION_INPUT = (By.CSS_SELECTOR, "input[type='radio'], textarea") 
    SUBMIT_ASSESSMENT_BTN = (By.XPATH, "//button[contains(text(), 'Submit')]")
    
    # Verification
    SUBMISSION_STATUS = (By.XPATH, "//*[contains(text(), 'Submitted') or contains(text(), 'Awaiting Grading')]")

    def __init__(self, driver):
        super().__init__(driver)

    def navigate_to_pending_tests(self):
        """Navigates to the tab containing pending tests."""
        self.click(self.PENDING_TESTS_TAB)

    def start_assessment(self, title):
        """Locates a test by title, expands the card, and starts it."""
        import time
        # Expand the test card
        expand_btn = (By.XPATH, f"//h2[contains(normalize-space(text()), '{title}')]/ancestor::article//button[i[contains(text(), 'keyboard_arrow')]]")
        self.click(expand_btn)
        time.sleep(1)
        
        # Click 'Start Test' on the expanded card
        start_btn = (By.XPATH, f"//h2[contains(normalize-space(text()), '{title}')]/ancestor::article//button[contains(normalize-space(text()), 'Start Test')]")
        self.click(start_btn)
        time.sleep(1)
        
        # Click 'Start Exam' on the modal
        modal_start_btn = (By.XPATH, "//app-modal//button[contains(normalize-space(text()), 'Start Exam')]")
        self.click(modal_start_btn)

    def complete_and_submit_assessment(self):
        """Fills out arbitrary answers and submits the test."""
        # Try to click the first radio button or fill the first textarea found
        if self.is_element_present(self.FIRST_QUESTION_INPUT):
            self.click(self.FIRST_QUESTION_INPUT)
            # If it was a textarea, send some text (this is robust enough to try typing if needed, 
            # though click works for radio. A real implementation might distinguish them).
            try:
                 self.send_keys(self.FIRST_QUESTION_INPUT, "Automated E2E Response")
            except:
                pass # If it's just a radio, send_keys might fail or be ignored.
        
        self.click(self.SUBMIT_ASSESSMENT_BTN)

    def verify_submission_status(self):
        """Checks if the submitted status is visible."""
        return self.wait_for_element_visible(self.SUBMISSION_STATUS).is_displayed()
