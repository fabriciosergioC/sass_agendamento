import assert from "node:assert/strict";
import test from "node:test";
import { buildSlotsUrl, clinicToday, parseSlots, slotReasonLabel, slotsEqual } from "../src/lib/slots.ts";

test("buildSlotsUrl envia serviceId, barberId e data como o backend espera", () => {
  assert.equal(
    buildSlotsUrl("bela-face", "svc 1", "brb/2", "2026-11-09"),
    "/api/public/bela-face/slots?serviceId=svc+1&barberId=brb%2F2&date=2026-11-09"
  );
});

test("parseSlots preserva a ordem e os flags exatos do backend", () => {
  const backend = {
    slots: [
      { start: "09:00", available: true },
      { start: "10:00", available: false, reason: "ocupado" },
      { start: "11:00", available: false, reason: "pausa" },
      { start: "12:00", available: false, reason: "passado" },
    ],
  };
  assert.deepEqual(parseSlots(backend), backend.slots);
  assert.deepEqual(parseSlots({ slots: [] }), []);
});

test("parseSlots rejeita resposta vazia, HTML ou contrato quebrado", () => {
  for (const data of [null, undefined, {}, { slots: null }, { slots: "09:00" }, { slots: [{ start: "9:00", available: true }] }, { slots: [{ start: "09:00" }] }, { slots: [{ start: "09:00", available: "true" }] }, { slots: [{ start: "09:00", available: true, reason: 1 }] }]) {
    assert.throws(() => parseSlots(data), /Resposta de horários inválida/);
  }
});

test("clinicToday usa o fuso do backend, não o fuso do aparelho", () => {
  assert.equal(clinicToday(new Date("2026-11-08T02:30:00Z")), "2026-11-07");
  assert.equal(clinicToday(new Date("2026-11-08T03:30:00Z")), "2026-11-08");
});

test("slotsEqual evita re-render quando o backend devolve a mesma disponibilidade", () => {
  const a = [{ start: "09:00", available: true }, { start: "09:30", available: false, reason: "ocupado" }];
  assert.equal(slotsEqual(a, [{ start: "09:00", available: true }, { start: "09:30", available: false, reason: "ocupado" }]), true);
  assert.equal(slotsEqual(a, [{ start: "09:00", available: false, reason: "ocupado" }, { start: "09:30", available: false, reason: "ocupado" }]), false);
  assert.equal(slotsEqual(a, [{ start: "09:00", available: true }]), false);
  assert.equal(slotsEqual([], []), true);
});

test("slotReasonLabel traduz os motivos devolvidos pelo backend", () => {
  assert.equal(slotReasonLabel("ocupado"), "Horário ocupado");
  assert.equal(slotReasonLabel("pausa"), "Intervalo do atendente");
  assert.equal(slotReasonLabel("passado"), "Horário já passou");
  assert.equal(slotReasonLabel(undefined), undefined);
});