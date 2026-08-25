import { useState } from 'react';
import { Button } from './Button/Button';
import { Modal } from './Modal/Modal';
import { Select } from './Select/Select';

// No topo da app (uma vez só), você importa os tokens gerados:
//   import '@fronteira-tokens/build/tokens.css';
// A partir daí todas as vars --mg-* existem e o VE as referencia.

// -- Uso 1: não-controlado, abrindo por um trigger --
export function ExemploComTrigger() {
  return (
    <Modal
      trigger={<Button variant="ghost">Configurações</Button>}
      title="Configurações do setor"
      description="Ajuste as preferências deste setor. As mudanças são aplicadas na hora."
      actions={
        <>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="primary">Salvar</Button>
        </>
      }
    >
      <p>Conteúdo do corpo do modal vai aqui.</p>
    </Modal>
  );
}

// -- Select: não-controlado --
export function ExemploSelect() {
  return (
    <Select
      aria-label="Setor"
      placeholder="Escolha um setor"
      defaultValue="rh"
      options={[
        { value: 'rh', label: 'Recursos Humanos' },
        { value: 'ti', label: 'Tecnologia' },
        { value: 'fin', label: 'Financeiro' },
        { value: 'op', label: 'Operações', disabled: true },
      ]}
    />
  );
}

// -- Select: controlado --
export function ExemploSelectControlado() {
  const [setor, setSetor] = useState('ti');
  return (
    <Select
      aria-label="Setor"
      value={setor}
      onValueChange={setSetor}
      options={[
        { value: 'rh', label: 'Recursos Humanos' },
        { value: 'ti', label: 'Tecnologia' },
        { value: 'fin', label: 'Financeiro' },
      ]}
    />
  );
}

// -- Uso 2: controlado (você decide quando abre/fecha) --
export function ExemploControlado() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Excluir registro
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Excluir este registro?"
        description="Esta ação não pode ser desfeita."
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Excluir
            </Button>
          </>
        }
      />
    </>
  );
}
