from ultralytics import YOLO

# Load the trained model
model = YOLO("best.pt")


def run_model():
    # Run inference on an image
    results = model("test-image.jpg")
    # Show the results
    results[0].show()




if __name__ == '__main__':
    run_model()