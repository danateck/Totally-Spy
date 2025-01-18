from Paddle import Paddle





class PaddleManager:
    def __new__(self, *args, **kwargs):
        if not hasattr(self, 'instance'):
            self.instance = super(PaddleManager, self).__new__(self)
        return self.instance

    def __int__(self):
        self.ocr = Paddle()

    def text_from_image(self, img_path, cls=True):
        result_ocr =  self.ocr.text_from_image(img_path, cls=cls)[0]
        only_texts = [line[1][0] for line in result_ocr if line[1][1] >= 0.5]
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
            if str(line[0][0]).isupper():
                lines.append(one_line)
                one_line = ""

            # If the last letter of the string is a period, it means that it is the end of the line
            for string in line:
                if string[-1] == '.':
                    one_line.join(string)
                    lines.append(one_line)
                    one_line = ""
                    continue

                one_line.join(string).join('')
        return lines