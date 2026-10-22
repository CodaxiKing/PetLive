import { describe, expect, it } from "vitest"
import {
  ehCelular,
  telefoneValido,
  limparTelefoneParaLink,
  formatarTelefone,
} from "./telefone"

describe("telefone utils", () => {
  describe("ehCelular", () => {
    it("identifica celular com 11 dígitos (DDD + 9xxxxxxxx)", () => {
      expect(ehCelular("21998765432")).toBe(true)
      expect(ehCelular("(21) 99876-5432")).toBe(true)
      expect(ehCelular("11999998888")).toBe(true)
    })

    it("identifica celular com +55 (13 dígitos)", () => {
      expect(ehCelular("+5521998765432")).toBe(true)
      expect(ehCelular("5521998765432")).toBe(true)
      expect(ehCelular("+55 21 99876-5432")).toBe(true)
    })

    it("não identifica fixo como celular", () => {
      expect(ehCelular("2133334444")).toBe(false)
      expect(ehCelular("(21) 3333-4444")).toBe(false)
      expect(ehCelular("+552133334444")).toBe(false)
      expect(ehCelular("552133334444")).toBe(false)
    })

    it("não identifica números inválidos como celular", () => {
      expect(ehCelular("2199876")).toBe(false)
      expect(ehCelular("")).toBe(false)
      expect(ehCelular("abc")).toBe(false)
      expect(ehCelular("219987654321")).toBe(false) // 12 dígitos sem +55
    })
  })

  describe("telefoneValido", () => {
    it("valida celular com 11 dígitos", () => {
      expect(telefoneValido("21998765432")).toBe(true)
      expect(telefoneValido("(21) 99876-5432")).toBe(true)
    })

    it("valida fixo com 10 dígitos", () => {
      expect(telefoneValido("2133334444")).toBe(true)
      expect(telefoneValido("(21) 3333-4444")).toBe(true)
    })

    it("valida com +55", () => {
      expect(telefoneValido("+5521998765432")).toBe(true)
      expect(telefoneValido("+552133334444")).toBe(true)
      expect(telefoneValido("5521998765432")).toBe(true)
      expect(telefoneValido("552133334444")).toBe(true)
    })

    it("rejeita números inválidos", () => {
      expect(telefoneValido("2199876")).toBe(false)
      expect(telefoneValido("")).toBe(false)
      expect(telefoneValido("abc")).toBe(false)
      expect(telefoneValido("219987654321")).toBe(false)
    })
  })

  describe("limparTelefoneParaLink", () => {
    it("limpa para tel: (mantém +)", () => {
      expect(limparTelefoneParaLink("21998765432", false)).toBe("+5521998765432")
      expect(limparTelefoneParaLink("(21) 99876-5432", false)).toBe("+5521998765432")
      expect(limparTelefoneParaLink("2133334444", false)).toBe("+552133334444")
      expect(limparTelefoneParaLink("+5521998765432", false)).toBe("+5521998765432")
    })

    it("limpa para wa.me (sem +, com 55)", () => {
      expect(limparTelefoneParaLink("21998765432", true)).toBe("5521998765432")
      expect(limparTelefoneParaLink("(21) 99876-5432", true)).toBe("5521998765432")
      expect(limparTelefoneParaLink("2133334444", true)).toBe("552133334444")
      expect(limparTelefoneParaLink("+5521998765432", true)).toBe("5521998765432")
    })
  })

  describe("formatarTelefone", () => {
    it("formata celular", () => {
      expect(formatarTelefone("21998765432")).toBe("(21) 99876-5432")
      expect(formatarTelefone("+5521998765432")).toBe("(21) 99876-5432")
    })

    it("formata fixo", () => {
      expect(formatarTelefone("2133334444")).toBe("(21) 3333-4444")
      expect(formatarTelefone("+552133334444")).toBe("(21) 3333-4444")
    })

    it("retorna vazio para string vazia", () => {
      expect(formatarTelefone("")).toBe("")
    })
  })
})