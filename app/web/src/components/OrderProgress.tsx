import { fmtDate } from "@/lib/format";
import { DIGITAL_FLOW, ORDER_FLOW, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orderStatus";

type Props = {
  status: OrderStatus;
  /** 物販品を含む注文だけ制作・発送の工程を表示する */
  physical: boolean;
  events?: { status: string; created_at: string }[];
};

/** 注文受付 → … → 完了 の進み具合 (制作状況の見える化) */
export function OrderProgress({ status, physical, events = [] }: Props) {
  if (status === "cancelled") {
    return (
      <div className="rounded-xl border border-coffee-200 bg-coffee-50 p-4 text-sm text-coffee-600">
        この注文はキャンセルされました。
      </div>
    );
  }

  const steps: OrderStatus[] = physical ? [...ORDER_FLOW] : DIGITAL_FLOW;
  // 完了した注文はすべての工程を「済み」にする
  const current = status === "completed" ? steps.length : steps.indexOf(status);
  // 工程に入った日時 (同じ工程に戻った場合は最新)
  const enteredAt = new Map(events.map((e) => [e.status, e.created_at]));

  return (
    <ol className={`grid gap-2 ${physical ? "grid-cols-4 sm:grid-cols-8" : "grid-cols-3"}`}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "invisible" : i <= current ? "bg-caramel" : "bg-coffee-200"}`} />
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  state === "done" ? "bg-caramel text-white"
                    : state === "current" ? "bg-white text-caramel ring-2 ring-caramel"
                    : "bg-coffee-100 text-coffee-400"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? "invisible" : i < current ? "bg-caramel" : "bg-coffee-200"}`} />
            </div>
            <span className={`mt-1.5 text-[11px] leading-tight ${state === "todo" ? "text-coffee-400" : "font-semibold text-coffee-800"}`}>
              {ORDER_STATUS_LABEL[s]}
            </span>
            {state !== "todo" && enteredAt.get(s) && (
              <span className="text-[10px] text-coffee-400 leading-tight">{fmtDate(enteredAt.get(s)).split(" ")[0]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
