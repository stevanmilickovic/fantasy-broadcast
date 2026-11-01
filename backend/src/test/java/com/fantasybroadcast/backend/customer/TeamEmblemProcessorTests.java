package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class TeamEmblemProcessorTests {
	private final TeamEmblemProcessor processor = new TeamEmblemProcessor();

	@Test void fitsNonSquarePngOnTransparentCanvasWithoutRetainingTrailingData() throws Exception {
		var original = new BufferedImage(1024, 512, BufferedImage.TYPE_INT_ARGB);
		original.setRGB(512, 256, 0xffff0000);
		var upload = new ByteArrayOutputStream();
		upload.write(png(original));
		upload.write("discard this uploaded metadata".getBytes(java.nio.charset.StandardCharsets.UTF_8));
		var result = processor.process(upload.toByteArray());
		var image = ImageIO.read(new ByteArrayInputStream(result));
		assertThat(image.getWidth()).isEqualTo(512);
		assertThat(image.getHeight()).isEqualTo(512);
		assertThat(image.getRGB(0, 0) >>> 24).isZero();
		assertThat(new String(result, java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("discard this");
	}

	@Test void detailedImagesAreReducedUntilTheyFitTheStoredByteBudget() throws Exception {
		var original = new BufferedImage(512, 512, BufferedImage.TYPE_INT_ARGB);
		var random = new java.util.Random(42);
		for (int y = 0; y < 512; y++) for (int x = 0; x < 512; x++) original.setRGB(x, y, random.nextInt());
		var upload = png(original);
		assertThat(upload.length).isGreaterThan(TeamEmblemProcessor.MAX_STORED_BYTES);
		var result = processor.process(upload);
		assertThat(result.length).isLessThanOrEqualTo(TeamEmblemProcessor.MAX_STORED_BYTES);
		assertThat(ImageIO.read(new ByteArrayInputStream(result)).getWidth()).isLessThan(512);
	}

	@Test void acceptsSmallPngWithoutUpscaling() throws Exception {
		var result = processor.process(png(new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB)));
		assertThat(ImageIO.read(new ByteArrayInputStream(result)).getWidth()).isEqualTo(1);
	}

	@Test void rejectsInvalidFormatsUploadsAndDecodedDimensions() throws Exception {
		var jpeg = new ByteArrayOutputStream();
		ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "jpeg", jpeg);
		for (var invalid : new byte[][] { {}, { 1, 2, 3 }, jpeg.toByteArray(), new byte[TeamEmblemProcessor.MAX_UPLOAD_BYTES + 1],
				png(new BufferedImage(4097, 1, BufferedImage.TYPE_INT_ARGB)) }) {
			assertThatThrownBy(() -> processor.process(invalid)).isInstanceOf(ResponseStatusException.class);
		}
	}

	static byte[] png(BufferedImage image) throws Exception {
		var bytes = new ByteArrayOutputStream();
		ImageIO.write(image, "png", bytes);
		return bytes.toByteArray();
	}
}
