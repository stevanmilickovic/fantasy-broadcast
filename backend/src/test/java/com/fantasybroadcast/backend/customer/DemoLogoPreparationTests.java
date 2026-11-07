package com.fantasybroadcast.backend.customer;

import static org.assertj.core.api.Assertions.assertThat;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DemoLogoPreparationTests {
	@TempDir Path directory;

	@Test
	void commandUsesUploadProcessorForNamedLogosAndCanPreserveOriginals() throws Exception {
		var source = Files.createDirectory(directory.resolve("originals"));
		var output = directory.resolve("output");
		var input = TeamEmblemProcessorTests.png(new BufferedImage(1024, 512, BufferedImage.TYPE_INT_ARGB));
		Files.write(source.resolve("north-bank.png"), input);
		Files.write(source.resolve("unrelated.png"), input);
		assertThat(run(source, output)).isZero();
		var optimized = Files.readAllBytes(output.resolve("north-bank.png"));
		assertThat(optimized).isEqualTo(new TeamEmblemProcessor().process(input));
		assertThat(Files.readAllBytes(source.resolve("north-bank.png"))).isEqualTo(input);
		assertThat(output.resolve("unrelated.png")).doesNotExist();
		var image = ImageIO.read(output.resolve("north-bank.png").toFile());
		assertThat(image.getWidth()).isEqualTo(512);
		assertThat(image.getHeight()).isEqualTo(512);
		// The default command also supports preparing files already placed in the public folder.
		assertThat(run(output, output)).isZero();
	}

	@Test
	void invalidBatchDoesNotReplaceAnyExistingLogos() throws Exception {
		var source = Files.createDirectory(directory.resolve("originals"));
		var output = Files.createDirectory(directory.resolve("output"));
		Files.write(source.resolve("north-bank.png"), TeamEmblemProcessorTests.png(new BufferedImage(2, 2, BufferedImage.TYPE_INT_ARGB)));
		Files.writeString(source.resolve("toulouse.png"), "not a PNG");
		Files.writeString(output.resolve("north-bank.png"), "existing logo");
		assertThat(run(source, output)).isNotZero();
		assertThat(Files.readString(output.resolve("north-bank.png"))).isEqualTo("existing logo");
		assertThat(output.resolve("toulouse.png")).doesNotExist();
	}

	private int run(Path source, Path output) throws Exception {
		var repository = Path.of("").toAbsolutePath();
		if (!Files.isDirectory(repository.resolve("scripts"))) repository = repository.getParent();
		var java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
		var log = directory.resolve("processor.log");
		var process = new ProcessBuilder(java, "-Djava.awt.headless=true", "--class-path",
				System.getProperty("surefire.test.class.path", System.getProperty("java.class.path")),
				repository.resolve("scripts/PrepareDemoLogos.java").toString(), source.toString(), output.toString())
				.redirectErrorStream(true).redirectOutput(log.toFile()).start();
		try {
			assertThat(process.waitFor(30, TimeUnit.SECONDS)).as("Logo command finished: %s", Files.readString(log)).isTrue();
			return process.exitValue();
		} finally {
			if (process.isAlive()) process.destroyForcibly();
		}
	}
}
