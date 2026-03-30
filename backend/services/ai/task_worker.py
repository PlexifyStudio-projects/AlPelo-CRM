"""
Lina Task Worker — Processes queued bulk tasks in background.
Called from the scheduler every 2 minutes during business hours.
Picks up pending/running LinaTasks, executes items in batches of 5,
updates progress, and logs results.
"""

import json
import traceback
from datetime import datetime

from sqlalchemy.orm import Session

from database.models import LinaTask
from activity_log import log_event

BATCH_SIZE = 5  # Items per cycle


def process_lina_tasks(db: Session):
    """Main entry point — called by scheduler every cycle.
    Finds pending/running tasks and processes the next batch of items."""

    tasks = (
        db.query(LinaTask)
        .filter(LinaTask.status.in_(["pending", "running"]))
        .order_by(LinaTask.created_at.asc())
        .all()
    )

    if not tasks:
        return

    for task in tasks:
        try:
            _process_single_task(task, db)
        except Exception as e:
            print(f"[LINA-WORKER] Error processing task #{task.id}: {e}")
            traceback.print_exc()
            task.status = "failed"
            # Append error to result_log
            result_log = _load_json(task.result_log, [])
            result_log.append({"error": str(e)[:200], "at": datetime.utcnow().isoformat()})
            task.result_log = json.dumps(result_log, ensure_ascii=False)
            task.updated_at = datetime.utcnow()
            db.commit()

            log_event(
                "tarea",
                f"Tarea #{task.id} falló: {task.description[:50]}",
                detail=str(e)[:200],
                status="error",
            )


def _process_single_task(task: LinaTask, db: Session):
    """Process the next batch of items for a single task."""
    from routes.ai_endpoints import _execute_action

    # Load payload (JSON array of action dicts)
    items = _load_json(task.payload, [])
    if not items:
        task.status = "failed"
        task.updated_at = datetime.utcnow()
        db.commit()
        log_event("tarea", f"Tarea #{task.id} sin items", detail=task.description[:80], status="error")
        return

    # Load existing results
    result_log = _load_json(task.result_log, [])

    # Mark as running
    if task.status == "pending":
        task.status = "running"
        task.updated_at = datetime.utcnow()
        db.commit()
        log_event(
            "tarea",
            f"Tarea #{task.id} iniciada: {task.description[:60]}",
            detail=f"0/{task.total_items} completados",
            status="info",
        )

    # Determine which items to process (skip already completed ones)
    start_idx = task.completed_items
    end_idx = min(start_idx + BATCH_SIZE, len(items))

    if start_idx >= len(items):
        # All done
        task.status = "completed"
        task.updated_at = datetime.utcnow()
        db.commit()
        return

    batch_ok = 0
    batch_fail = 0

    for i in range(start_idx, end_idx):
        item = items[i]
        try:
            # Inject tenant_id into each action
            item["tenant_id"] = task.tenant_id
            result = _execute_action(item, db)
            result_log.append({
                "index": i,
                "action": item.get("action", "?"),
                "result": result[:300] if result else "OK",
                "status": "ok" if not (result or "").startswith("ERROR") else "error",
            })
            if not (result or "").startswith("ERROR"):
                batch_ok += 1
            else:
                batch_fail += 1
        except Exception as e:
            result_log.append({
                "index": i,
                "action": item.get("action", "?"),
                "result": f"EXCEPTION: {str(e)[:200]}",
                "status": "error",
            })
            batch_fail += 1

        task.completed_items = i + 1

    # Save progress
    task.result_log = json.dumps(result_log, ensure_ascii=False)
    task.updated_at = datetime.utcnow()

    # Check if all items are done
    if task.completed_items >= task.total_items:
        task.status = "completed"
        db.commit()
        log_event(
            "tarea",
            f"Tarea completada: {task.description[:60]} — {task.total_items} items creados",
            detail=f"{task.total_items} procesados ({batch_fail} errores en ultimo batch)" if batch_fail else f"Todos los {task.total_items} items completados exitosamente",
            status="ok",
        )
        print(f"[LINA-WORKER] Task #{task.id} COMPLETED: {task.total_items} items")
    else:
        db.commit()
        log_event(
            "tarea",
            f"Tarea #{task.id}: {task.completed_items}/{task.total_items} — {task.description[:50]}",
            detail=f"Batch: {batch_ok} OK, {batch_fail} errores",
            status="info",
        )
        print(f"[LINA-WORKER] Task #{task.id}: {task.completed_items}/{task.total_items}")


def _load_json(text: str, default):
    """Safely load a JSON string, returning default on failure."""
    if not text:
        return default
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default
