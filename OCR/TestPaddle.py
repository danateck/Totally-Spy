import os
import time
import unittest
from OCR.PaddleManager import PaddleManager

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
        paddle_manager1 = PaddleManager()
        paddle_manager2 = PaddleManager()

        self.assertIs(paddle_manager1, paddle_manager2, "PaddleManager is not a singleton")
        self.assertIs(paddle_manager1.ocr, paddle_manager2.ocr, "Paddle is not a singleton")

    def test_images(self):
        paddle_manager = PaddleManager()
        image_dir = "./test_images"
        self.assertTrue(os.path.isdir(image_dir), f"Directory {image_dir} does not exist")

        for filename in os.listdir(image_dir):
            file_path = os.path.join(image_dir, filename)

            if filename.lower().endswith(('.png', '.jpg')):
                result = paddle_manager.text_from_image(file_path)
                result = " ".join(result)
                real_answer = self.dict_of_answers.get(filename, None)
                self.assertIsNotNone(real_answer, f"Real answer for {filename} is not provided")
                self.assertIn(real_answer, result, f"Expected: {real_answer}, got: {result}")

    def test_speed(self):
        paddle_manager = PaddleManager()
        filename = "basic_test_case.png"
        image_test = "./test_images/" + filename
        self.assertTrue(os.path.isfile(image_test), f"file {image_test} does not exist")
        time_now = time.time()
        result = paddle_manager.text_from_image(image_test)
        result = " ".join(result)
        real_answer = self.dict_of_answers.get(filename, None)
        self.assertIsNotNone(real_answer, f"Real answer for {filename} is not provided")
        self.assertIn(real_answer, result, f"Expected: {real_answer}, got: {result}")
        time_after = time.time()
        time_diff = time_after - time_now
        print(f"Time for {filename}: {time_diff} seconds")


if __name__ == '__main__':
    unittest.main()
