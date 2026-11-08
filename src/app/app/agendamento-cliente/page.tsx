import React from "react";

export default function AgendamentoPage() {
  return (
    <main className="min-h-screen bg-[#faf7f2] text-[#2d2d2d] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-[#e8e0d8]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#f5e6d8] text-[#b8893a] mb-3">
            ✨
          </div>
          <h1 className="text-xl font-semibold text-[#2d2d2d]">Clínica Estética</h1>
          <p className="text-sm text-[#6b6b6b]">Sistema de Agendamento Online</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-center text-[#6b6b6b]">
            Carregando serviços e horários disponíveis...
          </p>
          <div className="w-full h-2 bg-[#f5e6d8] rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-[#d4a24e] animate-pulse rounded-full"></div>
          </div>
        </div>
      </div>
    </main>
  );
}
