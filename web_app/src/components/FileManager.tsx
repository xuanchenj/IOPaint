import {
  SyntheticEvent,
  useEffect,
  useState,
  useCallback,
  useRef,
  FormEvent,
} from "react"
import _ from "lodash"
import PhotoAlbum from "react-photo-album"
import { BarsArrowDownIcon, BarsArrowUpIcon } from "@heroicons/react/24/outline"
import {
  MagnifyingGlassIcon,
  ViewHorizontalIcon,
  ViewGridIcon,
} from "@radix-ui/react-icons"
import { useToggle } from "react-use"
import { useDebounce } from "@uidotdev/usehooks"
import FlexSearch from "flexsearch/dist/flexsearch.bundle.js"
import { useToast } from "@/components/ui/use-toast"
import { API_ENDPOINT, getMedias } from "@/lib/api"
import { IconButton } from "./ui/button"
import { Input } from "./ui/input"
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { ScrollArea } from "./ui/scroll-area"
import { DialogTrigger } from "@radix-ui/react-dialog"
import { useHotkeys } from "react-hotkeys-hook"
import { useStore } from "@/lib/states"
import { SortBy, SortOrder } from "@/lib/types"
import { FolderClosed } from "lucide-react"

interface Photo {
  src: string
  height: number
  width: number
  name: string
}

interface Filename {
  name: string
  height: number
  width: number
  ctime: number
  mtime: number
}

const SORT_BY_NAME = "Name"
const SORT_BY_CREATED_TIME = "Created time"
const SORT_BY_MODIFIED_TIME = "Modified time"

const IMAGE_TAB = "image"
const OUTPUT_TAB = "output"

const SortByMap = {
  [SortBy.NAME]: SORT_BY_NAME,
  [SortBy.CTIME]: SORT_BY_CREATED_TIME,
  [SortBy.MTIME]: SORT_BY_MODIFIED_TIME,
}

interface Props {
  onPhotoClick(tab: string, filename: string): void
  photoWidth: number
}

export default function FileManager(props: Props) {
  const { onPhotoClick, photoWidth } = props
  const [open, toggleOpen] = useToggle(false)

  const [
    fileManagerState,
    setFileManagerLayout,
    setFileManagerSortBy,
    setFileManagerSortOrder,
    setFileManagerSearchText,
  ] = useStore((state) => [
    state.fileManagerState,
    state.setFileManagerLayout,
    state.setFileManagerSortBy,
    state.setFileManagerSortOrder,
    state.setFileManagerSearchText,
  ])

  useHotkeys("f", () => {
    toggleOpen()
  })

  const { toast } = useToast()
  const [scrollTop, setScrollTop] = useState(0)
  const [closeScrollTop, setCloseScrollTop] = useState(0)

  const ref = useRef(null)
  const debouncedSearchText = useDebounce(fileManagerState.searchText, 300)
  const [tab, setTab] = useState(IMAGE_TAB)
  const [photos, setPhotos] = useState<Photo[]>([])

  useEffect(() => {
    if (!open) {
      setCloseScrollTop(scrollTop)
    }
  }, [open, scrollTop])

  const onRefChange = useCallback(
    (node: HTMLDivElement) => {
      if (node !== null) {
        if (open) {
          setTimeout(() => {
            // TODO: without timeout, scrollTo not work, why?
            node.scrollTo({ top: closeScrollTop, left: 0 })
          }, 100)
        }
      }
    },
    [open, closeScrollTop]
  )

  useEffect(() => {
    if (!open) {
      return
    }
    const fetchData = async () => {
      try {
        const filenames = await getMedias(tab)
        let filteredFilenames = filenames
        if (debouncedSearchText) {
          const index = new FlexSearch.Index({
            tokenize: "forward",
            minlength: 1,
          })
          filenames.forEach((filename: Filename, id: number) =>
            index.add(id, filename.name)
          )
          const results: FlexSearch.IndexSearchResult =
            index.search(debouncedSearchText)
          filteredFilenames = results.map(
            (id: FlexSearch.Id) => filenames[id as number]
          )
        }

        filteredFilenames = _.orderBy(
          filteredFilenames,
          fileManagerState.sortBy,
          fileManagerState.sortOrder
        )

        const newPhotos = filteredFilenames.map((filename: Filename) => {
          const width = photoWidth
          const height = filename.height * (width / filename.width)
          const src = `${API_ENDPOINT}/media_thumbnail/${tab}/${filename.name}?width=${width}&height=${height}`
          return { src, height, width, name: filename.name }
        })
        setPhotos(newPhotos)
      } catch (e: any) {
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: e.message ? e.message : e.toString(),
        })
      }
    }
    fetchData()
  }, [tab, debouncedSearchText, fileManagerState, photoWidth, open])

  const onScroll = (event: SyntheticEvent) => {
    setScrollTop(event.currentTarget.scrollTop)
  }

  const onClick = ({ index }: { index: number }) => {
    toggleOpen()
    onPhotoClick(tab, photos[index].name)
  }

  const renderTitle = () => {
    return (
      <div className="flex justify-start items-center gap-[12px]">
        <div>{`Images (${photos.length})`}</div>
        <div className="flex">
          <IconButton
            tooltip="Rows layout"
            onClick={() => {
              setFileManagerLayout("rows")
            }}
          >
            <ViewHorizontalIcon
              className={fileManagerState.layout !== "rows" ? "opacity-50" : ""}
            />
          </IconButton>
          <IconButton
            tooltip="Grid layout"
            onClick={() => {
              setFileManagerLayout("masonry")
            }}
          >
            <ViewGridIcon
              className={
                fileManagerState.layout !== "masonry" ? "opacity-50" : ""
              }
            />
          </IconButton>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={toggleOpen}>
      <DialogTrigger asChild>
        <IconButton tooltip="File Manager">
          <FolderClosed />
        </IconButton>
      </DialogTrigger>
      <DialogContent className="h-4/5 max-w-6xl">
        <DialogTitle>{renderTitle()}</DialogTitle>
        <div className="flex justify-between gap-8 items-center">
          <div className="flex relative justify-start items-center">
            <MagnifyingGlassIcon className="absolute left-[8px]" />
            <Input
              ref={ref}
              value={fileManagerState.searchText}
              className="w-[250px] pl-[30px]"
              tabIndex={-1}
              onInput={(evt: FormEvent<HTMLInputElement>) => {
                evt.preventDefault()
                evt.stopPropagation()
                const target = evt.target as HTMLInputElement
                setFileManagerSearchText(target.value)
              }}
              placeholder="Search by file name"
            />
          </div>

          <Tabs defaultValue={tab} onValueChange={(val) => setTab(val)}>
            <TabsList aria-label="Manage your account">
              <TabsTrigger value={IMAGE_TAB}>Image Directory</TabsTrigger>
              <TabsTrigger value={OUTPUT_TAB}>Output Directory</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <div className="flex gap-1">
              <Select
                value={SortByMap[fileManagerState.sortBy]}
                onValueChange={(val) => {
                  switch (val) {
                    case SORT_BY_NAME:
                      setFileManagerSortBy(SortBy.NAME)
                      break
                    case SORT_BY_CREATED_TIME:
                      setFileManagerSortBy(SortBy.CTIME)
                      break
                    case SORT_BY_MODIFIED_TIME:
                      setFileManagerSortBy(SortBy.MTIME)
                      break
                    default:
                      break
                  }
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SortByMap).map((val) => {
                    return (
                      <SelectItem value={val} key={val}>
                        {val}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {fileManagerState.sortOrder === SortOrder.DESCENDING ? (
                <IconButton
                  tooltip="Descending Order"
                  onClick={() => {
                    setFileManagerSortOrder(SortOrder.ASCENDING)
                  }}
                >
                  <BarsArrowDownIcon />
                </IconButton>
              ) : (
                <IconButton
                  tooltip="Ascending Order"
                  onClick={() => {
                    setFileManagerSortOrder(SortOrder.DESCENDING)
                  }}
                >
                  <BarsArrowUpIcon />
                </IconButton>
              )}
            </div>
          </div>
        </div>

        <ScrollArea
          className="w-full h-full rounded-md"
          onScroll={onScroll}
          ref={onRefChange}
        >
          <PhotoAlbum
            layout={fileManagerState.layout}
            photos={photos}
            spacing={12}
            padding={0}
            onClick={onClick}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
