import com.fantasybroadcast.backend.customer.TeamEmblemProcessor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.List;

class PrepareDemoLogos {
    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Expected source and output directories.");
        var source = Path.of(args[0]);
        var output = Path.of(args[1]);
        var processor = new TeamEmblemProcessor();
        var prepared = new LinkedHashMap<String, byte[]>();
        for (var name : List.of("north-bank.png", "toulouse.png", "fuchs.png", "wanderers.png")) {
            var input = source.resolve(name);
            if (!Files.exists(input)) continue;
            if (Files.size(input) > TeamEmblemProcessor.MAX_UPLOAD_BYTES)
                throw new IllegalArgumentException(name + " exceeds the 5 MB upload limit.");
            prepared.put(name, processor.process(Files.readAllBytes(input)));
        }
        if (prepared.isEmpty()) {
            System.out.println("No preview PNGs found in " + source.toAbsolutePath());
            return;
        }
        Files.createDirectories(output);
        for (var logo : prepared.entrySet()) {
            var temporary = Files.createTempFile(output, ".demo-logo-", ".tmp");
            try {
                Files.write(temporary, logo.getValue());
                Files.move(temporary, output.resolve(logo.getKey()), StandardCopyOption.REPLACE_EXISTING);
            } finally {
                Files.deleteIfExists(temporary);
            }
            System.out.println(logo.getKey() + ": " + logo.getValue().length + " bytes");
        }
    }
}
