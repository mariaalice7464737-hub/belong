from .base import Provider, SearchContext
from .belong_local import BelongLocalProvider
from .google_places import GooglePlacesProvider
from .ticketmaster import TicketmasterProvider

__all__ = ["Provider", "SearchContext", "BelongLocalProvider", "GooglePlacesProvider", "TicketmasterProvider",
           "default_providers"]


def default_providers(settings) -> list[Provider]:
    """Para adicionar uma fonte nova: crie a classe em providers/ e inclua aqui. O contrato da API não muda."""
    return [BelongLocalProvider(settings), GooglePlacesProvider(settings), TicketmasterProvider(settings)]
