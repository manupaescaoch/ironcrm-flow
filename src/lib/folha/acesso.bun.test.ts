import { expect, it as test } from "bun:test";
import { perfilFolhaPermitido } from "./acesso";

test("Administrador pode acessar Folha", () => expect(perfilFolhaPermitido("admin")).toBe(true));
test("Gerente fica bloqueado temporariamente na Folha e Ajuda de Custo", () => expect(perfilFolhaPermitido("gerente")).toBe(false));
test("Coordenador não acessa Folha", () => expect(perfilFolhaPermitido("coordenador")).toBe(false));
test("Recepção não acessa Folha", () => expect(perfilFolhaPermitido("recepcao")).toBe(false));
test("Comercial não acessa Folha", () => expect(perfilFolhaPermitido("comercial")).toBe(false));
test("Perfil ainda não verificado não acessa Folha", () => expect(perfilFolhaPermitido(null)).toBe(false));
test("Usuário comum não acessa Folha e Ajuda de Custo", () => expect(perfilFolhaPermitido("user")).toBe(false));
test("Moderador não acessa Folha e Ajuda de Custo", () => expect(perfilFolhaPermitido("moderator")).toBe(false));