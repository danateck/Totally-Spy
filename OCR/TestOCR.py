import os
import time
import unittest

import cv2

from OCRManager import OCRManager

class TestPaddleOCR(unittest.TestCase):

    dict_of_answers = {
        "basic_test_case.png": "123456",
        "basic_test_case_blur_level_4.png": "123456",
        "basic_test_case_blur_level_8.png": "123456",
        "basic_test_case_blur_level_16.png": "123456",
        "clear_small_text.jpg": "882093",
        "test_img_num1.jpg": "704670",
        "test_img_num2.jpg": "320414",
        "test_img_num2_blur_level_11.png": "320414",
    }

    def test_singleton(self):
        ocr_manager1 = OCRManager()
        ocr_manager2 = OCRManager()

        self.assertIs(ocr_manager1, ocr_manager2, "OCRManager is not a singleton")

    def test_images(self):
        ocr_manager = OCRManager()
        image_dir = "./test_images"
        self.assertTrue(os.path.isdir(image_dir), f"Directory {image_dir} does not exist")

        for filename in os.listdir(image_dir):
            file_path = os.path.join(image_dir, filename)

            if filename.lower().endswith(('.png', '.jpg')):
                img = cv2.imread(file_path)
                result = ocr_manager.extract_text(img)
                message_result = result[0]
                real_answer = self.dict_of_answers.get(filename, None)
                self.assertIsNotNone(real_answer, f"Real answer for {filename} is not provided")
                self.assertIn(real_answer, message_result, f"Expected: {real_answer}, got: {message_result}")

    def test_speed(self):
        ocr_manager = OCRManager()
        filename = "basic_test_case.png"
        image_test = "./test_images/" + filename
        self.assertTrue(os.path.isfile(image_test), f"file {image_test} does not exist")
        img = cv2.imread(image_test)
        time_now = time.time()
        result = ocr_manager.extract_text(img)
        time_after = time.time()
        time_diff = time_after - time_now
        message_result = result[0]
        real_answer = self.dict_of_answers.get(filename, None)
        self.assertIsNotNone(real_answer, f"Real answer for {filename} is not provided")
        self.assertIn(real_answer, message_result, f"Expected: {real_answer}, got: {message_result}")

        print(f"Time for {filename}: {time_diff} seconds")


if __name__ == '__main__':
    unittest.main()
