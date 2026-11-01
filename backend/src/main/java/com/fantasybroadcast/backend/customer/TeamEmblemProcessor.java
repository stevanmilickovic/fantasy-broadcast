package com.fantasybroadcast.backend.customer;

import java.awt.AlphaComposite;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.Semaphore;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class TeamEmblemProcessor {

	public static final int MAX_UPLOAD_BYTES = 5_000_000;
	public static final int MAX_STORED_BYTES = 200_000;
	private final Semaphore processing = new Semaphore(1);

	public byte[] process(byte[] upload) {
		if (upload.length == 0 || upload.length > MAX_UPLOAD_BYTES)
			throw invalid("Choose a PNG image no larger than 5 MB.");
		// Bound decoded image memory and CPU on the smallest production server.
		if (!processing.tryAcquire())
			throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Image processing is busy. Please try again.");
		try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(upload))) {
			var readers = ImageIO.getImageReaders(input);
			if (!readers.hasNext()) throw invalid("Choose a valid PNG image.");
			var reader = readers.next();
			try {
				if (!reader.getFormatName().equalsIgnoreCase("png")) throw invalid("Choose a PNG image with a transparent background.");
				reader.setInput(input, true, true);
				int width = reader.getWidth(0), height = reader.getHeight(0);
				if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || (long) width * height > 16_000_000)
					throw invalid("PNG images must be at most 4096 pixels per side and 16 megapixels.");
				var source = reader.read(0);
				for (int size = Math.min(512, Math.max(width, height)); size >= 1; size = size * 3 / 4) {
					var image = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
					var graphics = image.createGraphics();
					try {
						graphics.setComposite(AlphaComposite.Src);
						graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
						double scale = (double) size / Math.max(width, height);
						int scaledWidth = Math.max(1, (int) Math.round(width * scale));
						int scaledHeight = Math.max(1, (int) Math.round(height * scale));
						graphics.drawImage(source, (size - scaledWidth) / 2, (size - scaledHeight) / 2, scaledWidth, scaledHeight, null);
					} finally { graphics.dispose(); }
					var encoded = encode(image);
					if (encoded.length <= MAX_STORED_BYTES) return encoded;
				}
				throw invalid("This PNG could not be compressed. Please choose another image.");
			} finally { reader.dispose(); }
		} catch (IOException | IllegalArgumentException exception) {
			throw invalid("This PNG could not be read. Please choose another image.");
		} finally { processing.release(); }
	}

	private byte[] encode(BufferedImage image) throws IOException {
		var bytes = new ByteArrayOutputStream();
		var writer = ImageIO.getImageWritersByFormatName("png").next();
		try (var output = new MemoryCacheImageOutputStream(bytes)) {
			writer.setOutput(output);
			var parameters = writer.getDefaultWriteParam();
			parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
			parameters.setCompressionQuality(0);
			// Re-encode pixels only; uploaded metadata and trailing content are discarded.
			writer.write(null, new IIOImage(image, null, null), parameters);
		} finally { writer.dispose(); }
		return bytes.toByteArray();
	}

	private ResponseStatusException invalid(String message) {
		return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
	}
}
