"""QR code generation utility for Order tray codes."""
import io
import uuid
import qrcode
from django.core.files.base import ContentFile


def generate_tray_code() -> str:
    """Generate a unique tray code string."""
    return f"TRAY-{uuid.uuid4().hex[:10].upper()}"


def generate_qr_image(tray_code: str) -> ContentFile:
    """
    Generate a QR code PNG for the given tray_code.
    Returns a Django ContentFile ready to be saved to an ImageField.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(tray_code)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return ContentFile(buffer.read(), name=f"{tray_code}.png")
