import React from "react";
import { Button } from "../../components/button";
import { Card } from "../../components/card";

export function AnimalServiceSent({ title, protocol, onBack }: { title: string; protocol?: string; onBack: () => void }) {
  return <Card as="section" className="tw:grid tw:justify-items-start tw:gap-3 tw:p-5">
    <div role="status">
      <h2 className="tw:m-0">{title}</h2>
      {protocol && <p>Protocolo: <strong>{protocol}</strong></p>}
    </div>
    <Button onClick={onBack}>Voltar aos meus animais</Button>
  </Card>;
}
