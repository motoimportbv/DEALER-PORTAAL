import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const SearchableSelect = React.forwardRef(({
  options = [],
  value,
  onValueChange,
  placeholder = "Selecteer...",
  searchPlaceholder = "Zoeken...",
  emptyText = "Geen resultaten gevonden.",
  disabled = false,
  className,
  "data-testid": dataTestId,
}, ref) => {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Find the label for the current value
  const selectedLabel = React.useMemo(() => {
    if (!value) return null
    const option = options.find(opt => 
      typeof opt === 'string' ? opt === value : opt.value === value
    )
    return option ? (typeof option === 'string' ? option : option.label) : value
  }, [options, value])

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options
    const searchLower = searchValue.toLowerCase()
    return options.filter(opt => {
      const label = typeof opt === 'string' ? opt : opt.label
      return label.toLowerCase().includes(searchLower)
    })
  }, [options, searchValue])

  const handleSelect = (selectedValue) => {
    onValueChange(selectedValue === value ? "" : selectedValue)
    setOpen(false)
    setSearchValue("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={dataTestId}
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const optionValue = typeof option === 'string' ? option : option.value
                const optionLabel = typeof option === 'string' ? option : option.label
                return (
                  <CommandItem
                    key={optionValue}
                    value={optionValue}
                    onSelect={() => handleSelect(optionValue)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === optionValue ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {optionLabel}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
})

SearchableSelect.displayName = "SearchableSelect"

export { SearchableSelect }
