---
title: Callouts
tags:
  - feature/transformer
---

Quartz supports the same Admonition-callout syntax as Obsidian.

This includes

- 12 Distinct callout types (each with several aliases)
- Collapsable callouts

```
> [!info] Title
> This is a callout!
```

See [documentation on supported types and syntax here](https://help.obsidian.md/Editing+and+formatting/Callouts).

> [!warning]
> Wondering why callouts may not be showing up even if you have them enabled? You may need to reorder your plugins so that [[ObsidianFlavoredMarkdown]] is _after_ [[SyntaxHighlighting]].

## Customization

The callouts are a functionality of the [[ObsidianFlavoredMarkdown]] plugin. See the plugin page for how to enable or disable them.

You can edit the icons by customizing `quartz/styles/callouts.scss`.

### Add custom callouts

By default, custom callouts are handled by applying the `note` style. To make fancy ones, you have to add these lines to `custom.scss`.

```scss title="quartz/styles/custom.scss"
.callout {
  &[data-callout="custom"] {
    --color: #customcolor;
    --border: #custombordercolor;
    --bg: #custombg;
    --callout-icon: url("data:image/svg+xml; utf8, <custom formatted svg>"); //SVG icon code
  }
}
```

> [!warning]
> Don't forget to ensure that the SVG is URL encoded before putting it in the CSS. You can use tools like [this one](https://yoksel.github.io/url-encoder/) to help you do that.

## Showcase

> [!info]
> Default title

> [!question]+ Can callouts be _nested_?
>
> > [!todo]- Yes!, they can. And collapsed!
> >
> > > [!example] You can even use multiple layers of nesting.

> [!note]
> Aliases: "note"

> [!abstract]
> Aliases: "abstract", "summary", "tldr"

> [!info]
> Aliases: "info"

> [!todo]
> Aliases: "todo"

> [!tip]
> Aliases: "tip", "hint", "important"

> [!success]
> Aliases: "success", "check", "done"

> [!question]
> Aliases: "question", "help", "faq"

> [!warning]
> Aliases: "warning", "attention", "caution"

> [!failure]
> Aliases: "failure", "missing", "fail"

> [!danger]
> Aliases: "danger", "error"

> [!bug]
> Aliases: "bug"

> [!example]
> Aliases: "example"

> [!quote]
> Aliases: "quote", "cite"

## Garden-specific callouts

Two extra callout types beyond the Obsidian set, for writing a request/answer exchange into a note.
They reuse the exact colours of the inline `@user` / `@assistant` gptel markers — user is question
yellow (`#dba642`), assistant is tip green (`#00bfa5`) — so a conversation reads the same whether it
is quoted inline or blocked out.

Defined in `quartz/styles/custom.scss`; aliases live in `calloutMapping` in
`quartz/plugins/transformers/ofm.ts`.

> [!user]
> Aliases: "user", "me"

> [!assistant]
> Aliases: "assistant", "ai", "bot"

Typical usage — give each side a title so the exchange stays readable when collapsed:

```
> [!user] 질문
> 콜아웃 종류를 어디서 늘리나요?

> [!assistant]- 답변
> `custom.scss`에 색을 정의하고, `ofm.ts`의 `calloutMapping`에 별칭을 추가합니다.
```
