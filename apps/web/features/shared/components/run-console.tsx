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
      typeof finalOutput?.final_text === "string"
        ? finalOutput.final_text
        : String(data.status ?? "completed");
    return trimConsoleText(finalText);
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
  const lastEvent = props.events.at(-1);

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
        {props.events.length === 0 ? (
          <p>点击运行后，这里会显示 run / step / tool / token 等事件流。</p>
        ) : (
          props.events.map((item, index) => (
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
