"""Helpers de permissão / scope por role.

Regras (definidas):
- admin: vê tudo, pode tudo
- gestor: vê tudo, pode tudo (auditoria depois)
- vendedor: vê só seus próprios deals/leads/atividades; pode criar/editar os seus
- bdr: vê só seus próprios deals/leads/atividades; pode criar/editar os seus
- leitor: vê tudo (igual admin) mas não pode criar/editar/excluir
"""
from __future__ import annotations

from fastapi import HTTPException, status

from app.models.user import User, UserRole


def is_readonly(user: User) -> bool:
    return user.role == UserRole.leitor


def is_admin_or_gestor(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.gestor)


def can_see_all(user: User) -> bool:
    """Quem vê dados de todos os users (não filtra por owner)."""
    return user.role in (UserRole.admin, UserRole.gestor, UserRole.leitor)


def assert_not_readonly(user: User) -> None:
    """Bloqueia mutação se user for leitor."""
    if is_readonly(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário com perfil 'leitor' não pode criar nem alterar dados",
        )


def filter_by_owner(query, model, user: User, owner_field: str = "owner_id"):
    """Aplica filtro de scope por owner se o user for vendedor/bdr."""
    if can_see_all(user):
        return query
    field = getattr(model, owner_field, None)
    if field is None:
        return query
    return query.filter(field == user.id)


def assert_owner_or_admin(obj, user: User, owner_field: str = "owner_id") -> None:
    """Garante que user pode mutar o objeto (é dele OU é admin/gestor)."""
    if can_see_all(user):
        return
    owner = getattr(obj, owner_field, None)
    if owner is None:
        return  # objeto sem owner → libera
    if owner != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o responsável ou admin/gestor pode alterar este item",
        )
