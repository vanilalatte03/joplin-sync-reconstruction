package lab;

import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:tests;DB_CLOSE_DELAY=-1")
class SyncEngineTest {
    @Autowired SyncEngine engine;
    @Autowired JdbcTemplate db;
    private SyncEngine.Mutation mutation(String client,String id,long base,String body,boolean deleted) {
        return new SyncEngine.Mutation(UUID.randomUUID(),client,id,base,"test",body,deleted);
    }
    private String id(){ return UUID.randomUUID().toString(); }
    @Test void createEditPullAndDelete() {
        String id=id();
        assertEquals(1,engine.apply(mutation("a",id,0,"한글",false)).reply().note().version());
        assertEquals(2,engine.apply(mutation("a",id,1,"edited",false)).reply().note().version());
        var tombstone=engine.apply(mutation("a",id,2,"edited",true));
        assertEquals(3,tombstone.reply().note().version());assertTrue(tombstone.reply().note().deleted());
        var changes=engine.changes(0).changes().stream().filter(c->c.note().id().equals(id)).toList();
        assertEquals(3,changes.size());assertTrue(changes.getLast().note().deleted());
    }
    @Test void staleWritePreservesBothBodies() {
        String id=id();engine.apply(mutation("a",id,0,"base",false));
        engine.apply(mutation("a",id,1,"A",false));
        var incoming=mutation("b",id,1,"B",false);var r=engine.apply(incoming);
        assertEquals(409,r.status());assertEquals("A",r.reply().note().body());
        assertTrue(engine.conflicts("b").stream().anyMatch(c->((SyncEngine.Mutation)c.get("incoming")).body().equals("B")));
        assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM conflicts WHERE op_id=?",Integer.class,incoming.opId().toString()));
    }
    @Test void duplicateOperationDoesNotIncrementVersionOrChangeLog() {
        String id=id();var m=mutation("a",id,0,"payload",false);
        assertEquals(engine.apply(m),engine.apply(m));
        assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM changes WHERE note_id=?",Integer.class,id));
    }
    @Test void duplicateConflictHasStableIdentity() {
        String id=id();engine.apply(mutation("a",id,0,"A",false));var m=mutation("b",id,0,"B",false);
        assertEquals(engine.apply(m),engine.apply(m));
        assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM conflicts WHERE op_id=?",Integer.class,m.opId().toString()));
    }
    @Test void operationIdCannotBeReusedForDifferentPayload() {
        var m=mutation("a",id(),0,"one",false);engine.apply(m);
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->engine.apply(new SyncEngine.Mutation(m.opId(),m.clientId(),m.noteId(),0,"test","different",false)));
    }
    @Test void editAfterRemoteDeleteIsAConflict() {
        String id=id();engine.apply(mutation("a",id,0,"base",false));engine.apply(mutation("a",id,1,"base",true));
        var r=engine.apply(mutation("b",id,1,"offline edit",false));assertEquals(409,r.status());assertTrue(r.reply().note().deleted());
    }
    @Test void simultaneousWritersHaveOneWinner() throws Exception {
        String id=id();engine.apply(mutation("a",id,0,"base",false));
        try(var pool=Executors.newVirtualThreadPerTaskExecutor()) {
            var ready=new CountDownLatch(2);var start=new CountDownLatch(1);
            var jobs=List.of("a","b").stream().map(client->pool.submit(()->{ready.countDown();start.await();return engine.apply(mutation(client,id,1,client,false)).status();})).toList();
            assertTrue(ready.await(5,TimeUnit.SECONDS));start.countDown();
            assertEquals(Set.of(200,409),Set.of(jobs.get(0).get(),jobs.get(1).get()));
        }
    }
    @Test void cursorIsMonotonicAndEmptyPollIsStable() {
        var first=engine.changes(0);engine.apply(mutation("a",id(),0,"next",false));var next=engine.changes(first.cursor());
        assertTrue(next.cursor()>first.cursor());assertEquals(next.cursor(),engine.changes(next.cursor()).cursor());
    }
}
