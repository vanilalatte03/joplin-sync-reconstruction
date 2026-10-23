package lab;

import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

@Service
public class SyncEngine {
    public record Mutation(@NotNull UUID opId,
        @NotBlank @Size(max=100) String clientId,
        @NotBlank @Pattern(regexp="[a-zA-Z0-9_-]{1,100}") String noteId,
        @Min(0) long baseVersion, @NotNull @Size(max=1000) String title,
        @NotNull @Size(max=100000) String body, boolean deleted) {}
    public record Note(String id, String title, String body, long version, boolean deleted) {}
    public record Reply(String outcome, String conflictId, Note note) {}
    public record Result(int status, Reply reply) {}
    public record Change(long seq, Note note) {}
    public record Delta(long cursor, List<Change> changes) {}
    private record StoredOperation(String payload, int status, String response) {}
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    public SyncEngine(JdbcTemplate db, TransactionTemplate tx, ObjectMapper json) {
        this.db=db; this.tx=tx; this.json=json;
    }
    // A single JVM serializes commit + cursor visibility. Multi-server writers are outside this lab's scope.
    public synchronized Result apply(Mutation m) {
        return tx.execute(ignored -> {
            String payload=json.writeValueAsString(m);
            var prior=db.query("SELECT * FROM operations WHERE op_id=?",(r,n)->new StoredOperation(r.getString("request_payload"),r.getInt("status"),r.getString("response_payload")),m.opId().toString());
            if (!prior.isEmpty()) {
                var p=prior.getFirst();
                if (!payload.equals(p.payload())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"opId reused with a different payload");
                return new Result(p.status(),json.readValue(p.response(),Reply.class));
            }
            Note current=find(m.noteId());
            long version=current==null?0:current.version();
            Result result;
            if (version!=m.baseVersion()) {
                String id=m.opId().toString();
                db.update("INSERT INTO conflicts VALUES (?,?,?,?,?,?)",id,m.clientId(),m.noteId(),m.baseVersion(),payload,json.writeValueAsString(current));
                result=new Result(409,new Reply("conflict",id,current));
            } else {
                Note next=new Note(m.noteId(),m.title(),m.body(),version+1,m.deleted());
                if (current==null) db.update("INSERT INTO notes VALUES (?,?,?,?,?)",next.id(),next.title(),next.body(),next.version(),next.deleted());
                else db.update("UPDATE notes SET title=?,body=?,version=?,deleted=? WHERE id=?",next.title(),next.body(),next.version(),next.deleted(),next.id());
                db.update("INSERT INTO changes(note_id,title,body,version,deleted) VALUES (?,?,?,?,?)",next.id(),next.title(),next.body(),next.version(),next.deleted());
                result=new Result(200,new Reply("applied",null,next));
            }
            db.update("INSERT INTO operations VALUES (?,?,?,?)",m.opId().toString(),payload,result.status(),json.writeValueAsString(result.reply()));
            return result;
        });
    }
    private Note find(String id) {
        var rows=db.query("SELECT * FROM notes WHERE id=?",(r,n)->new Note(r.getString("id"),r.getString("title"),r.getString("body"),r.getLong("version"),r.getBoolean("deleted")),id);
        return rows.isEmpty()?null:rows.getFirst();
    }
    public synchronized Delta changes(long after) {
        var changes=db.query("SELECT * FROM changes WHERE seq>? ORDER BY seq",(r,n)->new Change(r.getLong("seq"),new Note(r.getString("note_id"),r.getString("title"),r.getString("body"),r.getLong("version"),r.getBoolean("deleted"))),after);
        return new Delta(changes.isEmpty()?after:changes.getLast().seq(),changes);
    }
    public synchronized List<Map<String,Object>> conflicts(String clientId) {
        return db.query("SELECT * FROM conflicts WHERE client_id=? ORDER BY op_id",(r,n)->Map.of("opId",r.getString("op_id"),"incoming",json.readValue(r.getString("incoming_payload"),Mutation.class),"canonical",json.readTree(r.getString("canonical_payload"))),clientId);
    }
}
