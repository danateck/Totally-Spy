from Paddle import Paddle

class PaddleManager:
    def __new__(cls, *args, **kwargs):
        if not hasattr(cls, 'instance'):
            cls.instance = super(PaddleManager, cls).__new__(cls)
        return cls.instance

    def __init__(self):
        self.ocr = Paddle()

    def text_from_image(self, img_path, cls=True):
        result_ocr =  self.ocr.text_from_image(img_path, cls=cls)
        only_texts = [line[1][0] for line in result_ocr]
        lines = self.list_of_text_to_lines(only_texts)
        return lines

    def ocr_with_boxes(self, img_path, cls=True):
        return self.ocr.ocr_with_boxes(img_path, cls=cls)

    @staticmethod
    def list_of_text_to_lines(list_of_text):
        lines = []
        one_line = ""
        for line in list_of_text:
            # If the first letter of the line is uppercase, it means that it is a new line
            if str(line[0]).isupper():
                lines.append(one_line.rstrip())
                one_line = ""

            # If the last letter of the string is a period, it means that it is the end of the line
            words = line.split(' ')
            for word in words:
                if word == "":
                    continue

                if word[-1] == '.':
                    one_line += word
                    lines.append(one_line)
                    one_line = ""
                    continue

                one_line += word + ' '

        # If the last line is not empty, add it to the list
        if one_line != "":
            lines.append(one_line.rstrip())

        return lines
