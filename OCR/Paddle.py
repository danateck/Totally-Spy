from paddleocr import PaddleOCR, draw_ocr
from PIL import Image

class Paddle:
    ANGLE_CLS = True
    LANGUAGE = 'en'

    def __new__(self, *args, **kwargs):
        if not hasattr(self, 'instance'):
            self.instance = super(Paddle, self).__new__(self)
        return self.instance

    def __init__(self):
        self.ocr = PaddleOCR(use_angle_cls=self.ANGLE_CLS, lang=self.LANGUAGE)

    def text_from_image(self, img_path, cls=True):
        result_of_ocr = self.ocr.ocr(img_path, cls=cls)[0]
        return result_of_ocr

    def ocr_with_boxes(self, img_path, cls=True):
        result_of_ocr = self.text_from_image(img_path, cls=cls)
        image = Image.open(img_path).convert('RGB')
        boxes = [line[0] for line in result_of_ocr]
        txts = [line[1][0] for line in result_of_ocr]
        scores = [line[1][1] for line in result_of_ocr]
        im_show = draw_ocr(image, boxes, txts, scores, font_path='Fonts/arial.ttf')
        return Image.fromarray(im_show)
