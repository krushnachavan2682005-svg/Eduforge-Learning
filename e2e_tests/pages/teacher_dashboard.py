from selenium.webdriver.common.by import By
from pages.base_page import BasePage

class TeacherDashboard(BasePage):
    """Page object for the Teacher Dashboard and interactions."""
    
    # --- Locators ---
    CREATE_TEST_BTN = (By.XPATH, "//button[contains(text(), 'Create Assessment') or contains(text(), 'Create Test')]")
    TEST_TITLE_INPUT = (By.CSS_SELECTOR, "input[placeholder*='Title'], input[formcontrolname='title']")
    ASSIGN_STUDENT_DROPDOWN = (By.CSS_SELECTOR, "select[formcontrolname='student'], mat-select[formcontrolname='student']")
    # This locator assumes there's an option or an autocomplete for assigning a student
    SAVE_TEST_BTN = (By.XPATH, "//button[contains(text(), 'Save') or contains(text(), 'Publish')]")
    
    # Grading Locators
    GRADEBOOK_TAB = (By.XPATH, "//a[contains(text(), 'Gradebook') or contains(text(), 'Evaluation')]")
    SUBMISSION_SCORE_INPUT = (By.CSS_SELECTOR, "input[type='number'], input[formcontrolname='score']")
    SAVE_GRADE_BTN = (By.XPATH, "//button[contains(text(), 'Save Grade') or contains(text(), 'Publish Grade')]")
    STATUS_TEXT = (By.XPATH, "//*[contains(@class, 'status') or contains(@class, 'badge')]")

    def __init__(self, driver):
        super().__init__(driver)

    def create_assessment(self, title, student_email):
        """Creates a new assessment and assigns it to a student."""
        self.click(self.CREATE_TEST_BTN)
        self.send_keys(self.TEST_TITLE_INPUT, title)
        
        # Note: Handling dropdowns in Angular (e.g., mat-select) might require specific clicks.
        # This is a generic approach.
        self.click(self.ASSIGN_STUDENT_DROPDOWN)
        # Assuming we can find the option by text
        student_option = (By.XPATH, f"//mat-option//span[contains(text(), '{student_email}')] | //option[contains(text(), '{student_email}')]")
        self.click(student_option)
        
        self.click(self.SAVE_TEST_BTN)

    def navigate_to_gradebook(self):
        """Navigates to the evaluation/gradebook tab."""
        self.click(self.GRADEBOOK_TAB)

    def open_student_submission(self, student_email):
        """Finds and clicks on the submission for a specific student."""
        submission_row = (By.XPATH, f"//tr[contains(., '{student_email}')]//button[contains(text(), 'Evaluate') or contains(text(), 'View')]")
        self.click(submission_row)

    def grade_submission(self, score):
        """Inputs a score and publishes the grade."""
        self.send_keys(self.SUBMISSION_SCORE_INPUT, str(score))
        self.click(self.SAVE_GRADE_BTN)
        
    def get_submission_status(self, student_email):
        """Gets the status of a specific student's submission from the gradebook."""
        status_locator = (By.XPATH, f"//tr[contains(., '{student_email}')]//*[contains(@class, 'status') or contains(text(), 'Graded') or contains(text(), 'Published')]")
        return self.get_text(status_locator)
