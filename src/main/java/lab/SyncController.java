package lab;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;

@RestController
public class SyncController {
    private final SyncEngine engine;
    public SyncController(SyncEngine engine) { this.engine=engine; }
    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","UP"); }
    @PostMapping("/sync/push") public ResponseEntity<SyncEngine.Reply> push(@Valid @RequestBody SyncEngine.Mutation m) {
        var r=engine.apply(m); return ResponseEntity.status(r.status()).body(r.reply());
    }
    @GetMapping("/sync/pull") public SyncEngine.Delta pull(@RequestParam(defaultValue="0") long after) {
        if (after<0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"after must be nonnegative");
        return engine.changes(after);
    }
    @GetMapping("/conflicts") public List<Map<String,Object>> conflicts(@RequestParam String clientId) { return engine.conflicts(clientId); }
}
