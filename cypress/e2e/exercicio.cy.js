/// <reference types="cypress" />

describe('Testes da Funcionalidade Catálogo de Livros', () => {

let token
beforeEach(() => {
    cy.geraToken('admin@biblioteca.com', 'admin123').then(tkn => {
        token = tkn
    })
});

    // Objetivo: Verificar que a API retorna lista de livros com paginação e filtros funcionando
    // Validar que filtros por categoria e autores funcionam corretamente
    it('GET - Deve listar livros com filtros e paginação', () => {
        // Filtro por categoria + paginação
        cy.api({
            method: 'GET',
            url: 'books',
            qs: { category: 'Ficção', page: 1, limit: 2 }
        }).should(response => {
            expect(response.status).to.equal(200)
            expect(response.body.books).to.be.an('array').and.not.be.empty
            expect(response.body.books.length).to.be.at.most(2)
            response.body.books.forEach(livro => {
                expect(livro.category).to.equal('Ficção')
            })
            expect(response.body.pagination.limit).to.equal(2)
            expect(response.body.pagination.currentPage).to.equal(1)
        })

        // Filtro por autor
        cy.api({
            method: 'GET',
            url: 'books',
            qs: { author: 'Machado de Assis' }
        }).should(response => {
            expect(response.status).to.equal(200)
            expect(response.body.books).to.be.an('array').and.not.be.empty
            response.body.books.forEach(livro => {
                expect(livro.author).to.include('Machado de Assis')
            })
        })
    });

    // Objetivo: Validar que é possível obter detalhes de um livro específico pelo ID
    // Verificar que todos os campos do livro são retornados corretamente
    it('GET - Deve obter detalhes de um livro específico', () => {
        const campos = ['id', 'title', 'author', 'isbn', 'editor', 'category', 'language',
            'publication_year', 'pages', 'format', 'total_copies', 'available_copies', 'description']

        cy.api({
            method: 'GET',
            url: 'books/1'
        }).should(response => {
            expect(response.status).to.equal(200)
            expect(response.body.book.id).to.equal(1)
            campos.forEach(campo => {
                expect(response.body.book).to.have.property(campo)
            })
            expect(response.body.book.available_copies).to.be.at.most(response.body.book.total_copies)
        })
    });

    // Objetivo: Validar que um novo livro é adicionado com sucesso ao catálogo
    // Verificar que apenas admin pode adicionar novos livros (validação de permissão)
    it('POST - Deve cadastrar um novo livro com sucesso', () => {
        const livro = {
            title: `Livro QA ${Date.now()}`,
            author: 'Autor Teste EBAC',
            category: 'Tecnologia',
            total_copies: 3
        }

        // Admin cadastra com sucesso
        cy.api({
            method: 'POST',
            url: 'books',
            headers: { 'Authorization': token },
            body: livro
        }).should(response => {
            expect(response.status).to.equal(201)
            expect(response.body.message).to.equal('Livro criado com sucesso.')
            expect(response.body.book).to.have.property('id')
            expect(response.body.book.title).to.equal(livro.title)
            // Regra de negócio: no cadastro, todos os exemplares estão disponíveis
            expect(response.body.book.available_copies).to.equal(livro.total_copies)
        })

        // Usuário comum não pode cadastrar
        cy.geraToken('usuario@teste.com', 'user123').then(tokenUsuario => {
            cy.api({
                method: 'POST',
                url: 'books',
                headers: { 'Authorization': tokenUsuario },
                body: { title: `Livro QA Usuário ${Date.now()}`, author: 'Autor Teste EBAC' },
                failOnStatusCode: false
            }).should(response => {
                expect(response.status).to.equal(403)
                expect(response.body.error).to.equal('ADMIN_REQUIRED')
            })
        })
    });

    // Objetivo: Garantir que dados inválidos são rejeitados ao adicionar um livro
    // Validar mensagens de erro apropriadas para dados faltantes ou incorretos
    it('POST -  Deve rejeitar livro com dados inválidos', () => {
        const cenarios = [
            { body: { author: 'Autor Teste EBAC' }, mensagem: '"title" is required' },
            { body: { title: 'Livro Sem Autor' }, mensagem: '"author" is required' },
            { body: { title: 'Livro QA', author: 'Autor Teste EBAC', total_copies: 0 }, mensagem: '"total_copies" must be greater than or equal to 1' },
            { body: { title: 'Dom Casmurro', author: 'Machado de Assis' }, mensagem: 'Já existe um livro com este título e autor.' }
        ]

        cenarios.forEach(cenario => {
            cy.api({
                method: 'POST',
                url: 'books',
                headers: { 'Authorization': token },
                body: cenario.body,
                failOnStatusCode: false
            }).should(response => {
                expect(response.status).to.equal(400)
                expect(response.body.message).to.equal(cenario.mensagem)
            })
        })
    });

    // Objetivo: Validar que um livro pode ser atualizado com sucesso
    // Verificar que apenas admin pode atualizar livros (validação de permissão)
    it('PUT - Deve atualizar um livro previamente cadastrado', () => {
        const titulo = `Livro QA ${Date.now()}`

        cy.cadastrarLivro(token, titulo, 'Autor Teste EBAC').then(livroId => {
            // Admin atualiza com sucesso
            cy.api({
                method: 'PUT',
                url: `books/${livroId}`,
                headers: { 'Authorization': token },
                body: { title: `${titulo} - Atualizado`, author: 'Autor Teste EBAC', total_copies: 5 }
            }).should(response => {
                expect(response.status).to.equal(200)
                expect(response.body.message).to.equal('Livro atualizado com sucesso.')
                expect(response.body.bookId).to.equal(livroId)
            })

            // Confere que a alteração foi salva
            cy.api({
                method: 'GET',
                url: `books/${livroId}`
            }).should(response => {
                expect(response.body.book.title).to.equal(`${titulo} - Atualizado`)
                expect(response.body.book.total_copies).to.equal(5)
            })

            // Usuário comum não pode atualizar
            cy.geraToken('usuario@teste.com', 'user123').then(tokenUsuario => {
                cy.api({
                    method: 'PUT',
                    url: `books/${livroId}`,
                    headers: { 'Authorization': tokenUsuario },
                    body: { title: 'Título Alterado Por Usuário', author: 'Autor Teste EBAC' },
                    failOnStatusCode: false
                }).should(response => {
                    expect(response.status).to.equal(403)
                    expect(response.body.error).to.equal('ADMIN_REQUIRED')
                })
            })
        })
    });

    // Objetivo: Validar que um livro pode ser removido do catálogo
    // Verificar que apenas admin pode deletar livros (validação de permissão)
    it('DELETE - Deve deletar um livro previamente cadastrado', () => {
        cy.cadastrarLivro(token, `Livro QA ${Date.now()}`, 'Autor Teste EBAC').then(livroId => {
            // Usuário comum não pode deletar
            cy.geraToken('usuario@teste.com', 'user123').then(tokenUsuario => {
                cy.api({
                    method: 'DELETE',
                    url: `books/${livroId}`,
                    headers: { 'Authorization': tokenUsuario },
                    failOnStatusCode: false
                }).should(response => {
                    expect(response.status).to.equal(403)
                    expect(response.body.error).to.equal('ADMIN_REQUIRED')
                })
            })

            // Admin deleta com sucesso
            cy.api({
                method: 'DELETE',
                url: `books/${livroId}`,
                headers: { 'Authorization': token }
            }).should(response => {
                expect(response.status).to.equal(200)
                expect(response.body.message).to.equal('Livro deletado com sucesso.')
                expect(response.body.deletedBook.id).to.equal(livroId)
            })

            // Confere que o livro não existe mais
            cy.api({
                method: 'GET',
                url: `books/${livroId}`,
                failOnStatusCode: false
            }).should(response => {
                expect(response.status).to.equal(404)
                expect(response.body.message).to.equal('Livro não encontrado.')
            })
        })
    });
});
