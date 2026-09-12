import type {
  BackendRunDetail,
  BackendRunStreamEvent,
} from "../../flow/model/flow-api";

function trimConsoleText(value: string) {
  return value.length > 220 ? `${value.slice(0, 220)}...` : value;
}

function formatRunEventSummary(item: BackendRunStreamEvent) {
  const data = item.data as Record<string, unknown>;
  const output = data.output as Record<string, unknown> | undefined;
  const delta = typeof data.delta === "string" ? data.delta : "";

  if (item.event === "run.started") {
    return `status: ${String(data.status ?? "running")}\nrun: ${String(data.run_id ?? "-")}`;
  }

  if (item.event === "step.started") {
    return `node: ${String(data.node_id ?? "-")}\nagent: ${String(data.agent_id ?? data.node_type ?? "-")}`;
  }

  if (item.event === "step.completed") {
    const message =
      typeof output?.message === "string" ? output.message : "step completed";
    return trimConsoleText(message);
  }

  if (item.event === "run.completed") {
    const finalOutput = data.output as Record<string, unknown> | undefined;
    const finalText =
      typeof finalOutput?.summary === "string"
        ? finalOutput.summary
        : typeof finalOutput?.final_text === "string"
          ? finalOutput.final_text
        : String(data.status ?? "completed");
    return trimConsoleText(finalText);
  }

  if (item.event === "token.delta") {
    return trimConsoleText(delta);
  }

  if (item.event === "team.member.started") {
    return `agent: ${String(data.agent_name ?? data.agent_id ?? "-")}`;
  }

  if (item.event === "team.member.completed") {
    return `agent: ${String(data.agent_id ?? "-")}\nstatus: ${String(data.status ?? "completed")}`;
  }

  if (item.event === "team.completed") {
    return trimConsoleText(typeof output?.message === "string" ? output.message : "team completed");
  }

  if (item.event === "step.failed" || item.event === "run.failed") {
    return trimConsoleText(String(data.error ?? "failed"));
  }

  return trimConsoleText(JSON.stringify(item.data, null, 2));
}

export function RunConsole(props: {
  title: string;
  isRunning: boolean;
  events: BackendRunStreamEvent[];
  result: BackendRunDetail | null;
  showResult?: boolean;
}) {
  const renderedEvents = props.events.reduce<BackendRunStreamEvent[]>((items, event) => {
    if (event.event !== "token.delta") {
      items.push(event);
      return items;
    }

    const previous = items.at(-1);
    if (previous?.event === "token.delta") {
      previous.data = {
        ...previous.data,
        delta: `${String(previous.data.delta ?? "")}${String(event.data.delta ?? "")}`,
      };
      return items;
    }

    items.push({
      ...event,
      data: { ...event.data },
    });
    return items;
  }, []).filter((event) => event.event !== "run.started");
  const lastEvent = renderedEvents.at(-1);

  return (
    <div className="run-console">
      <div className="run-console-header">
        <div>
          <strong>{props.title}</strong>
          <span>
            {props.isRunning
              ? "Streaming..."
              : lastEvent
                ? lastEvent.event
                : "等待运行"}
          </span>
        </div>
        <div
          className={`run-console-light ${props.isRunning ? "is-running" : ""}`}
        />
      </div>

      <div className="run-console-feed">
        {renderedEvents.length === 0 ? (
          <p>点击运行后，这里会显示 run / step / tool / token 等事件流。</p>
        ) : (
          renderedEvents.map((item, index) => (
            <div key={`${item.event}_${index}`} className="run-console-event">
              <span>{item.event}</span>
              <pre>{formatRunEventSummary(item)}</pre>
            </div>
          ))
        )}
      </div>

      {props.showResult !== false && props.result ? (
        <div className="run-console-result">
          <span>Final Output</span>
          <pre>{JSON.stringify(props.result.output, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
